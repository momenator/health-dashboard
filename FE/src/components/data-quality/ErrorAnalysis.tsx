import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartCard, SeverityPill } from "./shared";
import type { DQData, QRow } from "@/lib/data-quality-data";
import { downloadBlob, toCsv } from "@/lib/data-quality-data";
import { Download, RotateCcw } from "lucide-react";

const SEV_COLORS: Record<string, string> = {
  critical: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--primary)",
};

function topN<T extends { value: number }>(arr: T[], n: number): T[] {
  return [...arr].sort((a, b) => b.value - a.value).slice(0, n);
}

export function ErrorAnalysis({ data }: { data: DQData }) {
  const [heatmapSeverity, setHeatmapSeverity] = useState<string>("all");
  const [sankeyIssueType, setSankeyIssueType] = useState<string>(
    data.issueTypes.includes("standardized_outcome")
      ? "standardized_outcome"
      : data.issueTypes[0] ?? "all",
  );
  const [critSearch, setCritSearch] = useState("");

  const issueTypeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.rows) m.set(r.issue_type, (m.get(r.issue_type) ?? 0) + 1);
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data]);

  const severityDist = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.rows) m.set(r.severity, (m.get(r.severity) ?? 0) + 1);
    const total = data.rows.length || 1;
    return Array.from(m, ([name, value]) => ({
      name,
      value,
      pct: (value / total) * 100,
    })).sort((a, b) => b.value - a.value);
  }, [data]);

  const topFields = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.rows) m.set(r.field_name, (m.get(r.field_name) ?? 0) + 1);
    return topN(
      Array.from(m, ([name, value]) => ({ name, value })),
      20,
    );
  }, [data]);

  const heatmap = useMemo(() => {
    const datasets = data.datasets;
    const types = data.issueTypes;
    const matrix = new Map<string, number>();
    let max = 0;
    for (const r of data.rows) {
      if (heatmapSeverity !== "all" && r.severity !== heatmapSeverity) continue;
      const k = `${r.table_name}|${r.issue_type}`;
      const v = (matrix.get(k) ?? 0) + 1;
      matrix.set(k, v);
      if (v > max) max = v;
    }
    return { datasets, types, matrix, max };
  }, [data, heatmapSeverity]);

  const sankey = useMemo(() => {
    const filter = sankeyIssueType === "all" ? null : sankeyIssueType;
    const counts = new Map<string, Map<string, number>>();
    for (const r of data.rows) {
      if (filter && r.issue_type !== filter) continue;
      const orig = (r.original_value ?? "").trim() || "(empty)";
      const dest = (r.cleaned_value ?? "").trim() || "(empty)";
      if (orig === dest) continue;
      if (!counts.has(orig)) counts.set(orig, new Map());
      const m = counts.get(orig)!;
      m.set(dest, (m.get(dest) ?? 0) + 1);
    }
    // top 25 source->destination links by volume
    const links: { source: string; target: string; value: number }[] = [];
    for (const [src, m] of counts) {
      for (const [dst, v] of m) links.push({ source: src, target: dst, value: v });
    }
    links.sort((a, b) => b.value - a.value);
    const top = links.slice(0, 25);
    const names = Array.from(
      new Set(top.flatMap((l) => [`◀ ${l.source}`, `${l.target} ▶`])),
    );
    const indexOf = new Map(names.map((n, i) => [n, i]));
    return {
      nodes: names.map((name) => ({ name })),
      links: top.map((l) => ({
        source: indexOf.get(`◀ ${l.source}`)!,
        target: indexOf.get(`${l.target} ▶`)!,
        value: l.value,
      })),
    };
  }, [data, sankeyIssueType]);

  const criticalRows = useMemo(() => {
    const q = critSearch.toLowerCase().trim();
    return data.rows
      .filter((r) => r.severity?.toLowerCase() === "critical")
      .filter((r) => {
        if (!q) return true;
        return (
          r.table_name.toLowerCase().includes(q) ||
          r.field_name.toLowerCase().includes(q) ||
          r.original_value?.toLowerCase().includes(q) ||
          r.cleaned_value?.toLowerCase().includes(q) ||
          r.issue_type?.toLowerCase().includes(q) ||
          r.note?.toLowerCase().includes(q)
        );
      });
  }, [data, critSearch]);

  const exportCritical = () => {
    const cols = [
      "table_name",
      "source_row_number",
      "field_name",
      "original_value",
      "cleaned_value",
      "issue_type",
      "severity",
      "note",
    ];
    downloadBlob(
      "critical-issues.csv",
      toCsv(criticalRows as unknown as Record<string, unknown>[], cols),
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard
          title="Most Common Issue Types"
          description="All detected issue types ranked by frequency."
        >
          <div style={{ height: Math.max(220, issueTypeCounts.length * 32 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={issueTypeCounts} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Severity Distribution"
          description="Share of corrections by severity."
        >
          <div style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityDist}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={120}
                  paddingAngle={2}
                >
                  {severityDist.map((d) => (
                    <Cell
                      key={d.name}
                      fill={SEV_COLORS[d.name?.toLowerCase()] ?? "var(--muted-foreground)"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, n, p) => [
                    `${v.toLocaleString()} (${p.payload.pct.toFixed(1)}%)`,
                    n,
                  ]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend
                  formatter={(value, entry) => {
                    const d = severityDist.find((x) => x.name === value);
                    return (
                      <span style={{ color: "var(--foreground)", fontSize: 12 }}>
                        {value} · {d ? d.pct.toFixed(1) : 0}%
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard
        title="Top 20 Fields by Corrections"
        description="Fields requiring the most attention."
      >
        <div style={{ height: Math.max(220, topFields.length * 28 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topFields} layout="vertical" margin={{ left: 20, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} interval={0} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Dataset × Issue Type Heatmap"
        description="Cell intensity = number of corrections."
        action={
          <Select value={heatmapSeverity} onValueChange={setHeatmapSeverity}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {data.severities.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <div className="overflow-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground p-2 sticky left-0 bg-card z-10 min-w-[180px]">
                  Dataset
                </th>
                {heatmap.types.map((t) => (
                  <th
                    key={t}
                    className="text-left font-medium text-muted-foreground p-2 whitespace-nowrap"
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.datasets.map((d) => (
                <tr key={d}>
                  <td className="p-2 sticky left-0 bg-card z-10 font-medium border-t">{d}</td>
                  {heatmap.types.map((t) => {
                    const v = heatmap.matrix.get(`${d}|${t}`) ?? 0;
                    const intensity = heatmap.max > 0 ? v / heatmap.max : 0;
                    const bg =
                      v === 0
                        ? "transparent"
                        : `color-mix(in oklch, var(--primary) ${Math.max(8, intensity * 100).toFixed(0)}%, transparent)`;
                    return (
                      <td
                        key={t}
                        className="border-t p-0"
                        title={`${d} · ${t}: ${v.toLocaleString()}`}
                      >
                        <div
                          className="h-9 min-w-[60px] flex items-center justify-center text-[11px] tabular-nums"
                          style={{
                            background: bg,
                            color: intensity > 0.55 ? "white" : "var(--foreground)",
                          }}
                        >
                          {v > 0 ? v.toLocaleString() : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ChartCard
        title="Value Standardization Flow"
        description="How inconsistent original values were mapped to standardized values (top 25 flows)."
        action={
          <Select value={sankeyIssueType} onValueChange={setSankeyIssueType}>
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All issue types</SelectItem>
              {data.issueTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <div style={{ height: 460 }}>
          {sankey.links.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No standardization flows for this filter.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={sankey}
                nodePadding={20}
                margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
                link={{ stroke: "var(--primary)", strokeOpacity: 0.25 }}
                node={{ fill: "var(--primary)" } as never}
              >
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </Sankey>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      <ChartCard
        title={`Critical Issues (${criticalRows.length.toLocaleString()})`}
        description="Searchable list of every critical correction."
        action={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search…"
              className="h-8 w-[200px] text-xs"
              value={critSearch}
              onChange={(e) => setCritSearch(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={exportCritical}
              disabled={criticalRows.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
            </Button>
            {critSearch && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setCritSearch("")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        }
      >
        <div className="max-h-[500px] overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Dataset</TableHead>
                <TableHead className="w-16">Row</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Original</TableHead>
                <TableHead>Corrected</TableHead>
                <TableHead>Issue Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {criticalRows.slice(0, 500).map((r: QRow) => (
                <TableRow key={r.row_id}>
                  <TableCell className="text-xs">{r.table_name}</TableCell>
                  <TableCell className="text-xs tabular-nums">{r.source_row_number}</TableCell>
                  <TableCell className="text-xs font-medium">{r.field_name}</TableCell>
                  <TableCell className="text-xs">
                    <code className="rounded bg-muted px-1.5 py-0.5">{r.original_value || "—"}</code>
                  </TableCell>
                  <TableCell className="text-xs">
                    <code className="rounded bg-success/10 text-success px-1.5 py-0.5">
                      {r.cleaned_value || "—"}
                    </code>
                  </TableCell>
                  <TableCell className="text-xs">{r.issue_type}</TableCell>
                  <TableCell>
                    <SeverityPill severity={r.severity} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                    {r.note}
                  </TableCell>
                </TableRow>
              ))}
              {criticalRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No critical issues match this search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {criticalRows.length > 500 && (
            <div className="text-center text-xs text-muted-foreground py-2 border-t">
              Showing first 500 of {criticalRows.length.toLocaleString()} — export CSV for full list.
            </div>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
