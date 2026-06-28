"""Map events tool - generates GeoJSON from CSV data using only verified coordinates."""

from __future__ import annotations

import csv
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Fields to never expose in map features
PRIVATE_FIELDS = {
    "record_id", "source_row_id", "source_file", "source_sheet",
    "source_row_number", "patient_key", "worker_id", "case_id",
}


def _load_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _parse_gps(gps_str: str) -> tuple[float, float] | None:
    """Parse GPS string 'lat lon [alt] [acc]' -> (lat, lon) or None."""
    if not gps_str or not gps_str.strip():
        return None
    parts = gps_str.strip().split()
    if len(parts) < 2:
        return None
    try:
        lat = float(parts[0])
        lon = float(parts[1])
        # Basic sanity check for Madagascar region
        if -30 < lat < 0 and 40 < lon < 55:
            return (lat, lon)
        return None
    except (ValueError, IndexError):
        return None


def _load_locations_master(data_dir: Path) -> dict[str, tuple[float, float]]:
    """Load locations_master.csv as lookup: facility_name -> (lat, lon)."""
    path = data_dir / "locations_master.csv"
    lookup: dict[str, tuple[float, float]] = {}
    if not path.exists():
        return lookup
    rows = _load_csv(path)
    for row in rows:
        lat_str = row.get("latitude", "").strip()
        lon_str = row.get("longitude", "").strip()
        if not lat_str or not lon_str:
            continue
        try:
            lat, lon = float(lat_str), float(lon_str)
        except ValueError:
            continue
        # Index by multiple keys for flexible lookup
        for key_field in ["facility_name", "site", "commune", "district"]:
            name = row.get(key_field, "").strip()
            if name and name not in lookup:
                lookup[name.lower()] = (lat, lon)
    return lookup


def _lookup_location(name: str, locations: dict[str, tuple[float, float]]) -> tuple[float, float] | None:
    """Try to find coordinates for a location name."""
    if not name:
        return None
    return locations.get(name.strip().lower())


def _build_sensitization_features(
    data_dir: Path, year: str, locations: dict[str, tuple[float, float]]
) -> tuple[list[dict], int, list[str]]:
    """Build GeoJSON features from sensitization_activities.csv."""
    rows = _load_csv(data_dir / "sensitization_activities.csv")
    features = []
    unmatched = 0
    missing_names: list[str] = []

    for row in rows:
        if row.get("year", "").strip() != year:
            continue

        coords = _parse_gps(row.get("gps", ""))
        precision = "gps" if coords else None

        # Try facility lookup if no GPS
        if not coords:
            for field in ["csb_location_name", "site", "commune"]:
                name = row.get(field, "").strip()
                coords = _lookup_location(name, locations)
                if coords:
                    precision = "facility_lookup"
                    break

        if not coords:
            unmatched += 1
            loc_name = row.get("csb_location_name", "") or row.get("site", "") or row.get("commune", "")
            if loc_name and loc_name not in missing_names:
                missing_names.append(loc_name)
            continue

        lat, lon = coords
        props = {
            "event_type": "sensitization_activity",
            "project": row.get("project", ""),
            "date": row.get("activity_date", ""),
            "region": row.get("region", ""),
            "district": row.get("district", ""),
            "commune": row.get("commune", ""),
            "fokontany": row.get("fokontany", ""),
            "site": row.get("site", ""),
            "participants": int(float(row.get("total_participants", "0") or "0")),
            "referrals": int(float(row.get("referrals_made", "0") or "0")),
            "sensitization_type": row.get("sensitization_type", ""),
            "location_precision": precision,
            "source_file": "sensitization_activities.csv",
        }

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": props,
        })

    return features, unmatched, missing_names


def _build_ambulance_features(
    data_dir: Path, year: str, locations: dict[str, tuple[float, float]]
) -> tuple[list[dict], int, list[str]]:
    """Build GeoJSON features from ambulance_trips.csv (only if coords in locations_master)."""
    rows = _load_csv(data_dir / "ambulance_trips.csv")
    features = []
    unmatched = 0
    missing_names: list[str] = []

    for row in rows:
        if row.get("year", "").strip() != year:
            continue

        # Try to find coords from CSB or site via locations_master
        coords = None
        precision = None
        for field in ["csb", "site", "reference_hospital"]:
            name = row.get(field, "").strip()
            coords = _lookup_location(name, locations)
            if coords:
                precision = "facility_lookup"
                break

        if not coords:
            unmatched += 1
            loc_name = row.get("csb", "") or row.get("site", "")
            if loc_name and loc_name not in missing_names:
                missing_names.append(loc_name)
            continue

        lat, lon = coords
        props = {
            "event_type": "ambulance_trip",
            "date": row.get("event_date", ""),
            "site": row.get("site", ""),
            "csb": row.get("csb", ""),
            "reference_hospital": row.get("reference_hospital", ""),
            "patient_type": row.get("patient_type", ""),
            "cause": row.get("cause", ""),
            "outcome": row.get("outcome", ""),
            "distance_km": row.get("distance_km", ""),
            "location_precision": precision,
            "source_file": "ambulance_trips.csv",
        }

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": props,
        })

    return features, unmatched, missing_names


def _build_aggregated_features(
    data_dir: Path, year: str, locations: dict[str, tuple[float, float]],
    filename: str, event_type: str
) -> tuple[list[dict], int, list[str]]:
    """Build aggregated GeoJSON features (by site/commune) for patient data."""
    rows = _load_csv(data_dir / filename)
    aggregated: dict[str, dict[str, Any]] = {}
    unmatched = 0
    missing_names: list[str] = []

    for row in rows:
        if row.get("year", "").strip() != year:
            continue

        # Aggregate key: site or commune
        site = row.get("site", "").strip()
        commune = row.get("commune", "").strip()
        agg_key = site or commune or row.get("district", "").strip()

        if not agg_key:
            unmatched += 1
            continue

        if agg_key not in aggregated:
            aggregated[agg_key] = {
                "count": 0,
                "site": site,
                "commune": commune,
                "district": row.get("district", ""),
                "region": row.get("region", ""),
            }
        aggregated[agg_key]["count"] += 1

    features = []
    for agg_key, data in aggregated.items():
        coords = _lookup_location(agg_key, locations)
        precision = "facility_lookup" if coords else None

        if not coords:
            unmatched += data["count"]
            if agg_key not in missing_names:
                missing_names.append(agg_key)
            continue

        lat, lon = coords
        props = {
            "event_type": event_type,
            "site": data["site"],
            "commune": data["commune"],
            "district": data["district"],
            "region": data["region"],
            "count": data["count"],
            "aggregation": f"Aggregated {data['count']} records at {agg_key}",
            "location_precision": precision,
            "source_file": filename,
        }

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": props,
        })

    return features, unmatched, missing_names


def generate_map_events(year: str | None = None) -> dict[str, Any]:
    """Generate GeoJSON FeatureCollection from all CSV sources.

    Only uses verified coordinates (GPS from CSV or locations_master.csv lookup).
    Never invents or guesses coordinates.
    """
    settings = get_settings()
    data_dir = Path(settings.data_dir)

    # Determine year
    if not year or year == "current":
        year = str(datetime.now().year)

    # Load location lookup
    locations = _load_locations_master(data_dir)

    all_features: list[dict] = []
    total_unmatched = 0
    all_missing: list[str] = []
    sources_used: list[str] = []

    # 1. Sensitization (primary source with GPS)
    sens_features, sens_unmatched, sens_missing = _build_sensitization_features(data_dir, year, locations)
    all_features.extend(sens_features)
    total_unmatched += sens_unmatched
    all_missing.extend(sens_missing)
    if sens_features or sens_unmatched:
        sources_used.append("sensitization_activities.csv")

    # 2. Ambulance trips (only with locations_master lookup)
    amb_features, amb_unmatched, amb_missing = _build_ambulance_features(data_dir, year, locations)
    all_features.extend(amb_features)
    total_unmatched += amb_unmatched
    all_missing.extend(amb_missing)
    if amb_features or amb_unmatched:
        sources_used.append("ambulance_trips.csv")

    # 3. MCHP Patient Support (aggregated, no individual rows)
    mchp_features, mchp_unmatched, mchp_missing = _build_aggregated_features(
        data_dir, year, locations, "mchp_patient_support.csv", "patient_support_aggregate"
    )
    all_features.extend(mchp_features)
    total_unmatched += mchp_unmatched
    all_missing.extend(mchp_missing)
    if mchp_features or mchp_unmatched:
        sources_used.append("mchp_patient_support.csv")

    # 4. TB Patient Journey (aggregated, no individual rows)
    tb_features, tb_unmatched, tb_missing = _build_aggregated_features(
        data_dir, year, locations, "tb_patient_journey.csv", "tb_aggregate"
    )
    all_features.extend(tb_features)
    total_unmatched += tb_unmatched
    all_missing.extend(tb_missing)
    if tb_features or tb_unmatched:
        sources_used.append("tb_patient_journey.csv")

    # Add locations_master if it was used
    if locations:
        sources_used.append("locations_master.csv")

    # Deduplicate missing names
    unique_missing = list(dict.fromkeys(all_missing))

    total_events = len(all_features) + total_unmatched

    return {
        "type": "FeatureCollection",
        "metadata": {
            "year": int(year),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_events": total_events,
            "plotted_events": len(all_features),
            "unmatched_locations": total_unmatched,
            "missing_location_lookup": unique_missing[:50],
            "sources": sources_used,
        },
        "features": all_features,
    }
