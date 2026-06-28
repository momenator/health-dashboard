import { Card, CardContent } from "@/components/ui/card";

export function HealthScoreCard({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const stroke =
    pct >= 80 ? "var(--color-success)" : pct >= 60 ? "var(--color-warning)" : "var(--color-danger)";
  const circ = 2 * Math.PI * 42;
  const offset = circ - (pct / 100) * circ;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 flex items-center gap-6">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--color-muted)"
              strokeWidth="10"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tracking-tight">{pct}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold">Project Health Score</div>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Composite score across data quality, KPI performance, reporting consistency, and
            service coverage.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
