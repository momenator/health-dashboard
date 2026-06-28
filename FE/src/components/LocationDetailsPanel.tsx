import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchLocationNews,
  normalizeLocationKey,
  type EventProps,
  type NewsItem,
} from "@/lib/map-events-api";
import type { SelectedFeature } from "@/components/FieldEventsMap";

const NEWS_CACHE_PREFIX = "dfm_location_news:";
const NEWS_TTL_MS = 24 * 60 * 60 * 1000;

type CachedNews = { ts: number; items: NewsItem[] };

function loadCachedNews(key: string): CachedNews | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NEWS_CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedNews;
  } catch {
    return null;
  }
}

function saveCachedNews(key: string, items: NewsItem[]) {
  try {
    window.localStorage.setItem(NEWS_CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), items }));
  } catch {
    /* local storage can be unavailable */
  }
}

function locationLabel(p: EventProps): string {
  return (
    (p.location_name as string | undefined) ??
    p.site ??
    p.fokontany ??
    p.commune ??
    p.district ??
    p.region ??
    "Field event location"
  );
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-1 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{String(value)}</span>
    </div>
  );
}

export function LocationDetailsPanel({
  selected,
  onClose,
}: {
  selected: SelectedFeature;
  onClose: () => void;
}) {
  const p = selected.properties;
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = normalizeLocationKey({
      location: locationLabel(p),
      district: p.district,
      region: p.region,
      lat: selected.lat,
      lon: selected.lon,
    });
    const cached = loadCachedNews(key);
    const fresh = cached && Date.now() - cached.ts < NEWS_TTL_MS;
    if (cached) setItems(cached.items);
    else setItems(null);
    setError(null);
    if (!fresh) setLoading(true);
    let cancelled = false;
    fetchLocationNews({
      lat: selected.lat,
      lon: selected.lon,
      location: locationLabel(p),
      district: p.district,
      region: p.region,
      radius_km: 50,
    })
      .then((news) => {
        if (cancelled) return;
        setItems(news);
        saveCachedNews(key, news);
      })
      .catch(() => {
        if (cancelled) return;
        if (!cached) setError("Live news could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, p]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b p-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{locationLabel(p)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[p.district, p.region].filter(Boolean).join(" · ") || "Madagascar"}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-5 overflow-y-auto p-4">
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Event details
          </h3>
          <div>
            <DetailRow label="Event type" value={p.event_type} />
            <DetailRow label="Project" value={p.project} />
            <DetailRow label="Date" value={p.date} />
            <DetailRow label="Site" value={p.site} />
            <DetailRow label="Commune" value={p.commune} />
            <DetailRow label="Fokontany" value={p.fokontany} />
            <DetailRow label="Participants" value={p.participants ?? p.count} />
            <DetailRow label="Location precision" value={p.location_precision} />
            <DetailRow label="Source" value={p.source_file} />
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Local news
          </h3>
          {loading && !items && <div className="text-xs text-muted-foreground">Loading local news...</div>}
          {error && !items?.length && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              {error}
            </div>
          )}
          {items && items.length === 0 && !loading && !error && (
            <div className="text-xs text-muted-foreground">
              No relevant recent news found for this area.
            </div>
          )}
          {items && items.length > 0 && (
            <ul className="space-y-3">
              {items.slice(0, 5).map((n, i) => (
                <li key={i} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium leading-snug">{n.title}</div>
                    {n.link && (
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-primary"
                        aria-label="Open article"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {[n.source, n.published_at].filter(Boolean).join(" · ")}
                  </div>
                  {n.summary && (
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{n.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
