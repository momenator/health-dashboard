import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { EventProps, FeatureCollection } from "@/lib/map-events-api";

const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MADAGASCAR_BOUNDS: L.LatLngBoundsLiteral = [
  [-26.5, 42.0],
  [-11.0, 51.5],
];

export type SelectedFeature = {
  properties: EventProps;
  lat: number;
  lon: number;
};

function esc(v: unknown): string {
  if (v === undefined || v === null || v === "") return "-";
  return String(v).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function FieldEventsMap({
  data,
  onSelect,
}: {
  data: FeatureCollection | null;
  onSelect?: (f: SelectedFeature) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [-19.0, 46.7],
      zoom: 6,
      minZoom: 5,
      maxBounds: L.latLngBounds(MADAGASCAR_BOUNDS),
      maxBoundsViscosity: 0.85,
      worldCopyJump: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }
    const cluster = L.markerClusterGroup();
    for (const feature of data.features ?? []) {
      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const [lng, lat] = coords;
      if (typeof lat !== "number" || typeof lng !== "number") continue;
      const props = feature.properties ?? {};
      const marker = L.marker([lat, lng], { icon: DefaultIcon });
      const label = esc(props.event_type ?? props.site ?? "Event");
      marker.bindPopup(
        `<div style="font-size:12px;min-width:140px">
          <div style="font-weight:600;margin-bottom:4px">${label}</div>
          <button data-view-details style="background:#2563eb;color:#fff;border:0;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:12px">View details</button>
        </div>`,
      );
      marker.on("popupopen", (event) => {
        const element = (event.popup.getElement() as HTMLElement | null)?.querySelector(
          "[data-view-details]",
        ) as HTMLButtonElement | null;
        if (element) {
          element.onclick = () => {
            onSelectRef.current?.({ properties: props, lat, lon: lng });
            map.closePopup();
          };
        }
      });
      marker.on("click", () => {
        onSelectRef.current?.({ properties: props, lat, lon: lng });
      });
      cluster.addLayer(marker);
    }
    map.addLayer(cluster);
    clusterRef.current = cluster;
  }, [data]);

  return <div ref={containerRef} className="h-[520px] w-full rounded-lg border" />;
}
