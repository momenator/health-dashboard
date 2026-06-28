import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { LocationDetailsPanel } from "@/components/LocationDetailsPanel";
import type { SelectedFeature } from "@/components/FieldEventsMap";
import { fetchMapEvents, type FeatureCollection } from "@/lib/map-events-api";
import { useIsMobile } from "@/hooks/use-mobile";

const FieldEventsMap = lazy(() =>
  import("@/components/FieldEventsMap").then((module) => ({ default: module.FieldEventsMap })),
);

const CACHE_KEY = "dfm_field_events_geojson";
const TIMESTAMP_KEY = "dfm_map_last_updated";

const FALLBACK_DATA: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [47.5079, -18.8792] },
      properties: {
        source: "fallback_demo_data",
        event_type: "Vaccination campaign",
        project: "Demo Project",
        date: "2025-03-12",
        region: "Analamanga",
        district: "Antananarivo",
        commune: "Antananarivo Renivohitra",
        fokontany: "Analakely",
        site: "CSB Analakely",
        participants: 142,
        location_precision: "Approximate",
        source_file: "fallback.csv",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [49.4023, -18.1492] },
      properties: {
        source: "fallback_demo_data",
        event_type: "Maternal health outreach",
        project: "Demo Project",
        date: "2025-04-02",
        region: "Atsinanana",
        district: "Toamasina I",
        commune: "Toamasina",
        fokontany: "Tanambao",
        site: "CSB Tanambao",
        participants: 68,
        location_precision: "Approximate",
        source_file: "fallback.csv",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [44.2731, -20.2843] },
      properties: {
        source: "fallback_demo_data",
        event_type: "Malaria screening",
        project: "Demo Project",
        date: "2025-05-18",
        region: "Menabe",
        district: "Morondava",
        commune: "Morondava",
        fokontany: "Andakabe",
        site: "Mobile clinic",
        participants: 95,
        location_precision: "Approximate",
        source_file: "fallback.csv",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [48.4669, -13.4054] },
      properties: {
        source: "fallback_demo_data",
        event_type: "Nutrition session",
        project: "Demo Project",
        date: "2025-02-21",
        region: "Diana",
        district: "Ambanja",
        commune: "Ambanja",
        fokontany: "Ambohimitsinjo",
        site: "CSB Ambanja",
        participants: 54,
        location_precision: "Approximate",
        source_file: "fallback.csv",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [46.8722, -23.3517] },
      properties: {
        source: "fallback_demo_data",
        event_type: "Community training",
        project: "Demo Project",
        date: "2025-06-09",
        region: "Ihorombe",
        district: "Ihosy",
        commune: "Ihosy",
        fokontany: "Ambalavato",
        site: "Training center",
        participants: 31,
        location_precision: "Approximate",
        source_file: "fallback.csv",
      },
    },
  ],
  meta: {
    total_events: 5,
    plotted_events: 5,
    unmatched_locations: 0,
    reporting_year: new Date().getFullYear(),
  },
};

function isFallback(data: FeatureCollection | null): boolean {
  return !!data?.features?.some((feature) => feature.properties?.source === "fallback_demo_data");
}

function loadCache(): { data: FeatureCollection; ts: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as FeatureCollection;
    if (!data?.features) return null;
    return { data, ts: window.localStorage.getItem(TIMESTAMP_KEY) };
  } catch {
    return null;
  }
}

function saveCache(data: FeatureCollection): string {
  const timestamp = new Date().toISOString();
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    window.localStorage.setItem(TIMESTAMP_KEY, timestamp);
  } catch {
    /* local storage can be unavailable */
  }
  return timestamp;
}

export function FieldEventsSection() {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => setMounted(true), []);

  const fetchFresh = useCallback(async (silent: boolean) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const fresh = await fetchMapEvents();
      setData(fresh);
      setLastUpdated(saveCache(fresh));
      setWarning(null);
    } catch {
      setWarning("Live backend data could not be loaded. Showing cached or demo map data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const cached = loadCache();
    if (cached) {
      setData(cached.data);
      setLastUpdated(cached.ts);
    } else {
      setData(FALLBACK_DATA);
    }
    void fetchFresh(false);
  }, [mounted, fetchFresh]);

  const meta = data?.meta ?? {};
  const totalEvents = meta.total_events ?? data?.features?.length ?? 0;
  const plotted = meta.plotted_events ?? data?.features?.length ?? 0;
  const unmatched = meta.unmatched_locations ?? 0;
  const year = String(meta.reporting_year ?? new Date().getFullYear());
  const usingFallback = isFallback(data);

  const summary = [
    { label: "Total events", value: totalEvents },
    { label: "Plotted on map", value: plotted },
    { label: "Unmatched locations", value: unmatched },
    { label: "Reporting year", value: year },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Field Activity Tracking</h2>
            {usingFallback && (
              <span className="rounded-md border border-warning/40 bg-warning/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning-foreground">
                Demo data shown
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            All field events for the current reporting year.
            {lastUpdated && <> · Last updated {new Date(lastUpdated).toLocaleString()}</>}
          </p>
        </div>
        <Button
          onClick={() => fetchFresh(true)}
          disabled={refreshing || loading}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
          {refreshing ? "Refreshing..." : "Refresh data"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-primary">
                {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {unmatched > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Some records could not be mapped because coordinates are missing.
        </div>
      )}

      {warning && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {warning}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative min-w-0 flex-1">
          {mounted && data ? (
            <Suspense
              fallback={
                <div className="flex h-[520px] w-full items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                  Loading map...
                </div>
              }
            >
              <FieldEventsMap data={data} onSelect={setSelected} />
            </Suspense>
          ) : (
            <div className="flex h-[520px] w-full items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
              Loading map...
            </div>
          )}
        </div>

        {!isMobile && selected && (
          <aside className="hidden h-[520px] w-[380px] shrink-0 overflow-hidden rounded-lg border bg-background lg:block xl:w-[400px]">
            <LocationDetailsPanel selected={selected} onClose={() => setSelected(null)} />
          </aside>
        )}
      </div>

      <Sheet open={isMobile && !!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="h-[80vh] p-0">
          {selected && <LocationDetailsPanel selected={selected} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
    </section>
  );
}
