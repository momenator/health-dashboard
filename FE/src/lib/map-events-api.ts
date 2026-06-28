const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

export type EventProps = {
  event_type?: string;
  project?: string;
  date?: string;
  region?: string;
  district?: string;
  commune?: string;
  fokontany?: string;
  site?: string;
  participants?: number | string;
  count?: number | string;
  location_precision?: string;
  source_file?: string;
  location_name?: string;
  [k: string]: unknown;
};

export type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: EventProps;
  }>;
  meta?: {
    total_events?: number;
    plotted_events?: number;
    unmatched_locations?: number;
    reporting_year?: number | string;
    last_updated?: string;
  };
};

export type NewsItem = {
  title: string;
  source?: string;
  published_at?: string;
  summary?: string;
  link?: string;
};

export type NewsResponse = {
  items: NewsItem[];
};

export async function fetchMapEvents(): Promise<FeatureCollection> {
  const res = await fetch(`${BASE_URL}/api/map-events?year=current`);
  if (!res.ok) throw new Error(`Failed to load map events (${res.status})`);
  return (await res.json()) as FeatureCollection;
}

export type LocationQuery = {
  lat: number;
  lon: number;
  location?: string;
  district?: string;
  region?: string;
  radius_km?: number;
};

export async function fetchLocationNews(q: LocationQuery): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    lat: String(q.lat),
    lon: String(q.lon),
    radius_km: String(q.radius_km ?? 50),
  });
  if (q.location) params.set("location", q.location);
  if (q.district) params.set("district", q.district);
  if (q.region) params.set("region", q.region);
  const res = await fetch(`${BASE_URL}/api/location-news?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to load news (${res.status})`);
  const data = (await res.json()) as NewsResponse | NewsItem[];
  const items = Array.isArray(data) ? data : (data.items ?? []);
  return items.slice(0, 5);
}

export function normalizeLocationKey(p: {
  location?: string;
  district?: string;
  region?: string;
  lat: number;
  lon: number;
}): string {
  const base = [p.location, p.district, p.region]
    .filter(Boolean)
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (base) return base;
  return `${p.lat.toFixed(2)}_${p.lon.toFixed(2)}`;
}
