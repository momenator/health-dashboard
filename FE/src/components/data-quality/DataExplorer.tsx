import { useDeferredValue, useMemo, useState } from "react";
import { List, type RowComponentProps } from "react-window";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Filter, RotateCcw } from "lucide-react";
import { SeverityPill } from "./shared";
import type { DQData, QRow } from "@/lib/data-quality-data";
import { downloadBlob, toCsv } from "@/lib/data-quality-data";

type Filters = {
  dataset: string;
  severity: string;
  issueType: string;
  field: string;
  search: string;
};

const initial: Filters = {
  dataset: "all",
  severity: "all",
  issueType: "all",
  field: "all",
  search: "",
};

type SortKey = keyof Pick<
  QRow,
  "table_name" | "field_name" | "original_value" | "cleaned_value" | "issue_type" | "severity"
>;

const COLS: { key: SortKey | "note"; label: string; flex: string }[] = [
  { key: "table_name", label: "Dataset", flex: "w-[18%] min-w-[140px]" },
  { key: "field_name", label: "Field", flex: "w-[12%] min-w-[100px]" },
  { key: "original_value", label: "Original", flex: "w-[14%] min-w-[110px]" },
  { key: "cleaned_value", label: "Corrected", flex: "w-[14%] min-w-[110px]" },
  { key: "issue_type", label: "Issue Type", flex: "w-[14%] min-w-[120px]" },
  { key: "severity", label: "Severity", flex: "w-[8%] min-w-[90px]" },
  { key: "note", label: "Notes", flex: "flex-1 min-w-[160px]" },
];

function Row({ index, style, rows }: RowComponentProps<{ rows: QRow[] }>) {
  const r = rows[index];
  if (!r) return null;
  return (
    <div
      style={style}
      className="flex items-center gap-2 border-b border-border px-3 text-xs hover:bg-muted/40"
    >
      <div className={`${COLS[0].flex} truncate`}>{r.table_name}</div>
      <div className={`${COLS[1].flex} truncate font-medium`}>{r.field_name}</div>
      <div className={`${COLS[2].flex} truncate`}>
        <code className="rounded bg-muted px-1.5 py-0.5">{r.original_value || "—"}</code>
      </div>
      <div className={`${COLS[3].flex} truncate`}>
        <code className="rounded bg-success/10 text-success px-1.5 py-0.5">
          {r.cleaned_value || "—"}
        </code>
      </div>
      <div className={`${COLS[4].flex} truncate`}>{r.issue_type}</div>
      <div className={COLS[5].flex}>
        <SeverityPill severity={r.severity} />
      </div>
      <div className={`${COLS[6].flex} truncate text-muted-foreground`}>{r.note}</div>
    </div>
  );
}

export function DataExplorer({ data }: { data: DQData }) {
  const [filters, setFilters] = useState<Filters>(initial);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "table_name",
    dir: "asc",
  });
  const deferredSearch = useDeferredValue(filters.search);

  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    const out: QRow[] = [];
    for (const r of data.rows) {
      if (filters.dataset !== "all" && r.table_name !== filters.dataset) continue;
      if (filters.severity !== "all" && r.severity !== filters.severity) continue;
      if (filters.issueType !== "all" && r.issue_type !== filters.issueType) continue;
      if (filters.field !== "all" && r.field_name !== filters.field) continue;
      if (q) {
        const hay =
          r.table_name +
          " " +
          r.field_name +
          " " +
          r.original_value +
          " " +
          r.cleaned_value +
          " " +
          r.issue_type +
          " " +
          r.note;
        if (!hay.toLowerCase().includes(q)) continue;
      }
      out.push(r);
    }
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    out.sort((a, b) => (a[key] ?? "").localeCompare(b[key] ?? "") * mul);
    return out;
  }, [data, filters, deferredSearch, sort]);

  const fieldsForDataset = useMemo(() => {
    if (filters.dataset === "all") return data.fields;
    const s = new Set<string>();
    for (const r of data.rows) if (r.table_name === filters.dataset) s.add(r.field_name);
    return Array.from(s).sort();
  }, [data, filters.dataset]);

  const handleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  const exportCsv = () => {
    const cols = [
      "table_name",
      "source_file",
      "source_sheet",
      "source_row_number",
      "field_name",
      "original_value",
      "cleaned_value",
      "issue_type",
      "severity",
      "note",
    ];
    downloadBlob(
      "data-quality-export.csv",
      toCsv(filtered as unknown as Record<string, unknown>[], cols),
    );
  };

  const reset = () => setFilters(initial);
  const activeCount = Object.entries(filters).filter(
    ([k, v]) => v !== (initial as Record<string, string>)[k] && v !== "",
  ).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" /> Filters
          </div>
          <Select
            value={filters.dataset}
            onValueChange={(v) => setFilters((f) => ({ ...f, dataset: v, field: "all" }))}
          >
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Dataset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All datasets</SelectItem>
              {data.datasets.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.severity}
            onValueChange={(v) => setFilters((f) => ({ ...f, severity: v }))}
          >
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Severity" />
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
          <Select
            value={filters.issueType}
            onValueChange={(v) => setFilters((f) => ({ ...f, issueType: v }))}
          >
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Issue type" />
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
          <Select
            value={filters.field}
            onValueChange={(v) => setFilters((f) => ({ ...f, field: v }))}
          >
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fields</SelectItem>
              {fieldsForDataset.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search values, notes…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="w-[220px] h-9"
          />
          <div className="flex-1" />
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-3 py-2.5 text-xs text-muted-foreground border-b">
            <span className="tabular-nums font-medium text-foreground">
              {filtered.length.toLocaleString()}
            </span>{" "}
            of {data.rows.length.toLocaleString()} corrections
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
            {COLS.map((c) => (
              <button
                key={c.key}
                onClick={() => c.key !== "note" && handleSort(c.key as SortKey)}
                className={`${c.flex} text-left ${c.key !== "note" ? "hover:text-foreground cursor-pointer" : ""}`}
              >
                {c.label}
                {sort.key === c.key && (
                  <span className="ml-1">{sort.dir === "asc" ? "▲" : "▼"}</span>
                )}
              </button>
            ))}
          </div>
          <List
            rowComponent={Row}
            rowCount={filtered.length}
            rowHeight={40}
            rowProps={{ rows: filtered }}
            defaultHeight={560}
            style={{ height: 560 }}
          />
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">
              No corrections match these filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
