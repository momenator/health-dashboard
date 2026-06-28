import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Download,
  Flag,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  downloadBlob,
  toCsv,
  type DQData,
  type QRow,
} from "@/lib/data-quality-data";

type Category = "critical" | "flagged" | "no-action";
type Status = "new" | "reviewed" | "corrected" | "accepted";

const STATUSES: Status[] = ["new", "reviewed", "corrected", "accepted"];
const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  reviewed: "Reviewed",
  corrected: "Corrected",
  accepted: "Accepted",
};

interface IssueMeta {
  label: string;
  category: Category;
  explanation: string;
}

const ISSUE_META: Record<string, IssueMeta> = {
  bmi_out_of_range: {
    label: "Impossible BMI value",
    category: "critical",
    explanation: "BMI outside biologically plausible range.",
  },
  age_out_of_range: {
    label: "Impossible age",
    category: "critical",
    explanation: "Age value outside the plausible human range.",
  },
  height_out_of_range: {
    label: "Impossible height",
    category: "critical",
    explanation: "Height value outside the plausible human range.",
  },
  numeric_parse_failed: {
    label: "Parsing issue (numeric)",
    category: "flagged",
    explanation: "A numeric field contained a value that could not be parsed.",
  },
  date_sequence_conflict: {
    label: "Date inconsistency",
    category: "flagged",
    explanation: "Dates that conflict with one another (e.g. end before start).",
  },
  placeholder_or_implausible_date: {
    label: "Improbable date",
    category: "flagged",
    explanation: "Placeholder or implausible date value.",
  },
  standardized_yes_no: {
    label: "Standardized yes/no",
    category: "no-action",
    explanation: "",
  },
  standardized_lab_result: {
    label: "Standardized lab result",
    category: "no-action",
    explanation: "",
  },
  standardized_sex: {
    label: "Standardized sex label",
    category: "no-action",
    explanation: "",
  },
  standardized_outcome: {
    label: "Standardized outcome",
    category: "no-action",
    explanation: "",
  },
};

function metaFor(row: QRow): IssueMeta {
  const m = ISSUE_META[row.issue_type];
  if (m) return m;
  const sev = (row.severity || "").toLowerCase();
  const cat: Category = sev === "critical" ? "critical" : sev === "info" ? "no-action" : "flagged";
  return {
    label: row.issue_type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    category: cat,
    explanation: "",
  };
}

function categoryOf(row: QRow): Category {
  return metaFor(row).category;
}

function topCount(values: string[]): string {
  if (values.length === 0) return "—";
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  let best = "";
  let n = 0;
  for (const [k, c] of m) if (c > n) (best = k), (n = c);
  return best || "—";
}

const CATEGORY_ORDER: Record<Category, number> = { critical: 0, flagged: 1, "no-action": 2 };

const STORAGE_KEY = "dq.statuses.v1";

function loadStatuses(): Record<string, Status> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Status>) : {};
  } catch {
    return {};
  }
}

export function GroupedIssues({ data }: { data: DQData }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  useEffect(() => setStatuses(loadStatuses()), []);
  const setStatus = (rowId: string, s: Status) => {
    setStatuses((prev) => {
      const next = { ...prev, [rowId]: s };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const statusOf = (rowId: string): Status => statuses[rowId] ?? "new";

  const [search, setSearch] = useState("");
  const [fCategory, setFCategory] = useState<string>("all");
  const [fIssue, setFIssue] = useState<string>("all");
  const [fFile, setFFile] = useState<string>("all");
  const [fField, setFField] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");

  const sourceFiles = useMemo(
    () => Array.from(new Set(data.rows.map((r) => r.source_file).filter(Boolean))).sort(),
    [data],
  );

  // Apply filters & search to the full dataset first.
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.rows.filter((r) => {
      if (fCategory !== "all" && categoryOf(r) !== fCategory) return false;
      if (fIssue !== "all" && r.issue_type !== fIssue) return false;
      if (fFile !== "all" && r.source_file !== fFile) return false;
      if (fField !== "all" && r.field_name !== fField) return false;
      if (fStatus !== "all" && statusOf(r.row_id) !== fStatus) return false;
      if (q) {
        const hay =
          `${r.source_row_number} ${r.field_name} ${r.original_value} ${r.issue_type} ${r.source_file}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, fCategory, fIssue, fFile, fField, fStatus, search, statuses]);

  // Summary counts always reflect the full dataset (not filters).
  const totals = useMemo(() => {
    let critical = 0;
    let flagged = 0;
    let noAction = 0;
    for (const r of data.rows) {
      const c = categoryOf(r);
      if (c === "critical") critical++;
      else if (c === "flagged") flagged++;
      else noAction++;
    }
    return { critical, flagged, noAction };
  }, [data]);

  // Group filtered rows by issue_type.
  const groups = useMemo(() => {
    const byType = new Map<string, QRow[]>();
    for (const r of filtered) {
      const arr = byType.get(r.issue_type) ?? [];
      arr.push(r);
      byType.set(r.issue_type, arr);
    }
    const arr = Array.from(byType, ([issueType, rows]) => {
      const sample = rows[0];
      const meta = metaFor(sample);
      return {
        issueType,
        rows,
        meta,
        topField: topCount(rows.map((r) => r.field_name)),
        topFile: topCount(rows.map((r) => r.source_file)),
        count: rows.length,
      };
    });
    arr.sort((a, b) => {
      const ord = CATEGORY_ORDER[a.meta.category] - CATEGORY_ORDER[b.meta.category];
      if (ord !== 0) return ord;
      return b.count - a.count;
    });
    return arr.filter((g) => g.meta.category !== "no-action");
  }, [filtered]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Default: critical & flagged open, no-action collapsed.
  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (!(g.issueType in next)) {
          next[g.issueType] = g.meta.category !== "no-action";
        }
      }
      return next;
    });
  }, [groups]);

  const toggle = (key: string) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  const exportRows = (predicate: (r: QRow) => boolean, filename: string) => {
    const rows = data.rows.filter(predicate).map((r) => ({
      severity: r.severity,
      category: categoryOf(r),
      issue_type: r.issue_type,
      source_file: r.source_file,
      sheet: r.source_sheet,
      row_number: r.source_row_number,
      field: r.field_name,
      original_value: r.original_value,
      cleaned_value: r.cleaned_value,
      note: r.note,
      status: statusOf(r.row_id),
    }));
    downloadBlob(filename, toCsv(rows as unknown as Record<string, unknown>[], [
      "severity",
      "category",
      "issue_type",
      "source_file",
      "sheet",
      "row_number",
      "field",
      "original_value",
      "cleaned_value",
      "note",
      "status",
    ]));
  };

  const resetFilters = () => {
    setSearch("");
    setFCategory("all");
    setFIssue("all");
    setFFile("all");
    setFField("all");
    setFStatus("all");
  };

  const anyCritical = totals.critical > 0;
  const anyFlagged = totals.flagged > 0;
  

  return (
    <div className="space-y-6">
      {/* Top: summary + exports */}
      <div className="flex flex-col xl:flex-row xl:items-stretch gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          <SummaryCard
            tone="critical"
            icon={<ShieldAlert className="h-5 w-5" />}
            label="Critical Issues"
            value={totals.critical}
            hint="Unrealistic or impossible values"
          />
          <SummaryCard
            tone="flagged"
            icon={<Flag className="h-5 w-5" />}
            label="Flagged Issues"
            value={totals.flagged}
            hint="Questionable — review before reporting"
          />
          <SummaryCard
            tone="no-action"
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="No Action"
            value={totals.noAction}
            hint="Records that do not require action"
          />
        </div>
        <div className="flex flex-col gap-2 xl:w-[280px]">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() =>
              exportRows((r) => categoryOf(r) === "critical", "critical-issues.csv")
            }
            disabled={totals.critical === 0}
          >
            <Download className="h-4 w-4 mr-2" /> Export Critical Issues
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() =>
              exportRows((r) => categoryOf(r) === "flagged", "flagged-issues.csv")
            }
            disabled={totals.flagged === 0}
          >
            <Download className="h-4 w-4 mr-2" /> Export Flagged Issues
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() =>
              exportRows(
                (r) => categoryOf(r) !== "no-action",
                "records-requiring-review.csv",
              )
            }
            disabled={totals.critical + totals.flagged === 0}
          >
            <Download className="h-4 w-4 mr-2" /> Export Both Critical and Flagged Issues
          </Button>
        </div>
      </div>



      {/* Empty states */}
      {groups.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No records match these filters.
          </CardContent>
        </Card>
      )}


      <div className="pt-8">
        <h2 className="text-sm font-semibold tracking-tight">Detailed issue review</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Expand an issue type to inspect the affected records.</p>
      </div>

      <div className="space-y-3">
        {groups.map((g) => {
          const isOpen = !!open[g.issueType];
          const tone = g.meta.category;
          return (
            <Card
              key={g.issueType}
              className={cn(
                "overflow-hidden transition-colors",
                tone === "critical" && "border-danger/40",
                tone === "flagged" && "border-warning/40",
                tone === "no-action" && "opacity-90",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(g.issueType)}
                className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-muted-foreground">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-sm">{g.meta.label}</h3>
                      <CategoryPill category={tone} />
                      <span className="text-xs text-muted-foreground">
                        · {g.issueType}
                      </span>
                    </div>
                    {g.meta.explanation && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {g.meta.explanation}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        <span className="text-foreground font-semibold tabular-nums">
                          {g.count.toLocaleString()}
                        </span>{" "}
                        affected records
                      </span>
                      <span>
                        Most affected field:{" "}
                        <span className="text-foreground font-medium">{g.topField}</span>
                      </span>
                      <span>
                        Most affected file:{" "}
                        <span className="text-foreground font-medium">{g.topFile}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {isOpen && (
                <GroupTable
                  rows={g.rows}
                  statusOf={statusOf}
                  setStatus={setStatus}
                />
              )}
            </Card>
          );
        })}
      </div>

      {/* Section-level empties */}
      {!anyCritical && (
        <Card className="border-dashed">
          <CardContent className="p-4 text-xs text-muted-foreground">
            No critical issues found.
          </CardContent>
        </Card>
      )}
      {!anyFlagged && (
        <Card className="border-dashed">
          <CardContent className="p-4 text-xs text-muted-foreground">
            No flagged issues found.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const MAX_VISIBLE = 300;

function GroupTable({
  rows,
  statusOf,
  setStatus,
}: {
  rows: QRow[];
  statusOf: (id: string) => Status;
  setStatus: (id: string, s: Status) => void;
}) {
  const visible = rows.slice(0, MAX_VISIBLE);
  return (
    <div className="border-t bg-muted/20">
      <div className="max-h-[440px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur z-10">
            <TableRow>
              <TableHead className="text-xs">Source File</TableHead>
              <TableHead className="text-xs w-28">Sheet</TableHead>
              <TableHead className="text-xs w-16">Row #</TableHead>
              <TableHead className="text-xs">Field</TableHead>
              <TableHead className="text-xs">Original</TableHead>
              <TableHead className="text-xs">Cleaned</TableHead>
              <TableHead className="text-xs">Note</TableHead>
              <TableHead className="text-xs w-36">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow key={r.row_id}>
                <TableCell className="text-xs font-mono">{r.source_file}</TableCell>
                <TableCell className="text-xs">{r.source_sheet}</TableCell>
                <TableCell className="text-xs tabular-nums font-semibold">
                  {r.source_row_number}
                </TableCell>
                <TableCell className="text-xs font-medium">{r.field_name}</TableCell>
                <TableCell className="text-xs">
                  <code className="rounded bg-background px-1.5 py-0.5">
                    {r.original_value || "—"}
                  </code>
                </TableCell>
                <TableCell className="text-xs">
                  <code className="rounded bg-success/10 text-success px-1.5 py-0.5">
                    {r.cleaned_value || "—"}
                  </code>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                  {r.note}
                </TableCell>
                <TableCell>
                  <Select
                    value={statusOf(r.row_id)}
                    onValueChange={(v) => setStatus(r.row_id, v as Status)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length > MAX_VISIBLE && (
        <div className="text-center text-xs text-muted-foreground py-2 border-t bg-card">
          Showing first {MAX_VISIBLE.toLocaleString()} of {rows.length.toLocaleString()} —
          use filters or export for the full list.
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  tone,
  icon,
  label,
  value,
  hint,
}: {
  tone: Category;
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  const styles =
    tone === "critical"
      ? "border-danger/40 bg-danger/5 text-danger"
      : tone === "flagged"
        ? "border-warning/40 bg-warning/5 text-warning-foreground"
        : "border-success/30 bg-success/5 text-success";
  return (
    <Card className={cn("border", styles)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
          {icon} {label}
        </div>
        <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
          {value.toLocaleString()}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function CategoryPill({ category }: { category: Category }) {
  const map: Record<Category, { label: string; cls: string; icon: React.ReactNode }> = {
    critical: {
      label: "Critical",
      cls: "bg-danger/15 text-danger border-danger/40",
      icon: <ShieldAlert className="h-3 w-3" />,
    },
    flagged: {
      label: "Flagged",
      cls: "bg-warning/20 text-warning-foreground border-warning/40",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    "no-action": {
      label: "No Action",
      cls: "bg-success/10 text-success border-success/30",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
  };
  const m = map[category];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        m.cls,
      )}
    >
      {m.icon} {m.label}
    </span>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  width: number;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs" style={{ width }}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[320px]">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
