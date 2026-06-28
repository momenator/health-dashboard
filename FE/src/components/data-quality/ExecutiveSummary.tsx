import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { AlertOctagon, AlertTriangle, Database, Info } from "lucide-react";
import type { DQData } from "@/lib/data-quality-data";
import { ChartCard } from "./shared";
import { cn } from "@/lib/utils";

function Kpi({
  label,
  value,
  pct,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  pct?: number;
  icon: typeof Database;
  tone: "default" | "danger" | "warning" | "info";
}) {
  const toneClass = {
    default: "text-primary bg-primary/10",
    danger: "text-danger bg-danger/15",
    warning: "text-warning-foreground bg-warning/20",
    info: "text-primary bg-primary/10",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
              {value.toLocaleString()}
            </div>
            {pct !== undefined && (
              <div className="mt-1 text-xs text-muted-foreground">
                {pct.toFixed(1)}% of total
              </div>
            )}
          </div>
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneClass)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const SEV_COLORS: Record<string, string> = {
  critical: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--primary)",
};

export function ExecutiveSummary({ data }: { data: DQData }) {
  const stats = useMemo(() => {
    let critical = 0,
      warning = 0,
      info = 0;
    for (const r of data.rows) {
      const s = r.severity?.toLowerCase();
      if (s === "critical") critical++;
      else if (s === "warning") warning++;
      else if (s === "info") info++;
    }
    const total = data.rows.length;
    return { total, critical, warning, info };
  }, [data]);

  const byDataset = useMemo(() => {
    return [...data.summary]
      .map((s) => ({
        name: s.table_name,
        total: s.issue_count,
        critical: s.critical_issue_count,
        warning: s.warning_issue_count,
        info: s.info_issue_count,
        density: s.rows > 0 ? s.issue_count / s.rows : 0,
        rows: s.rows,
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const density = useMemo(
    () => [...byDataset].sort((a, b) => b.density - a.density),
    [byDataset],
  );

  const confidence = useMemo(() => {
    return data.summary.map((s) => {
      const t = s.high_confidence_rows + s.medium_confidence_rows + s.low_confidence_rows || 1;
      return {
        name: s.table_name,
        High: (s.high_confidence_rows / t) * 100,
        Medium: (s.medium_confidence_rows / t) * 100,
        Low: (s.low_confidence_rows / t) * 100,
      };
    });
  }, [data]);

  const chartHeight = Math.max(200, byDataset.length * 40 + 40);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Total Corrections"
          value={stats.total}
          icon={Database}
          tone="default"
        />
        <Kpi
          label="Critical Issues"
          value={stats.critical}
          pct={(stats.critical / stats.total) * 100}
          icon={AlertOctagon}
          tone="danger"
        />
        <Kpi
          label="Warning Issues"
          value={stats.warning}
          pct={(stats.warning / stats.total) * 100}
          icon={AlertTriangle}
          tone="warning"
        />
        <Kpi
          label="Informational Issues"
          value={stats.info}
          pct={(stats.info / stats.total) * 100}
          icon={Info}
          tone="info"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard
          title="Issues by Dataset"
          description="Total corrections per dataset, sorted highest to lowest."
        >
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDataset} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Severity Breakdown by Dataset"
          description="Stacked critical / warning / info counts."
        >
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDataset} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="critical" stackId="s" fill={SEV_COLORS.critical} />
                <Bar dataKey="warning" stackId="s" fill={SEV_COLORS.warning} />
                <Bar dataKey="info" stackId="s" fill={SEV_COLORS.info} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard
          title="Confidence Overview"
          description="Row confidence distribution per dataset (%)."
        >
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={confidence}
                layout="vertical"
                stackOffset="expand"
                margin={{ left: 20, right: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="High" stackId="c" fill="var(--success)" />
                <Bar dataKey="Medium" stackId="c" fill="var(--warning)" />
                <Bar dataKey="Low" stackId="c" fill="var(--danger)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Issue Density by Dataset"
          description="Issues per row — datasets requiring the closest review."
        >
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={density} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v.toFixed(1)} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip
                  formatter={(v: number, _n, p) => [
                    `${v.toFixed(2)} issues/row (${p.payload.total.toLocaleString()} / ${p.payload.rows.toLocaleString()})`,
                    "Density",
                  ]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="density" radius={[0, 4, 4, 0]}>
                  {density.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.density > 5
                          ? "var(--danger)"
                          : d.density > 1
                            ? "var(--warning)"
                            : "var(--primary)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
