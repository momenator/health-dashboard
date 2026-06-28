import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { loadDataQuality, type DQData } from "@/lib/data-quality-data";
import { GroupedIssues } from "@/components/data-quality/GroupedIssues";

export const Route = createFileRoute("/_app/data-quality")({
  head: () => ({
    meta: [
      { title: "Data Quality · M&E Copilot" },
      {
        name: "description",
        content:
          "Grouped review of critical and flagged records across project datasets.",
      },
    ],
  }),
  component: DataQuality,
});

function DataQuality() {
  const [data, setData] = useState<DQData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    loadDataQuality()
      .then((d) => !cancel && setData(d))
      .catch((e) => !cancel && setError(String(e?.message ?? e)));
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Portfolio
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">Data Quality</h1>
      </div>

      {error && (
        <Card>
          <CardContent className="p-6 text-sm text-danger">
            Failed to load data: {error}
          </CardContent>
        </Card>
      )}

      {!data && !error && (
        <Card>
          <CardContent className="p-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <div className="text-sm">Loading records…</div>
          </CardContent>
        </Card>
      )}

      {data && <GroupedIssues data={data} />}
    </div>
  );
}
