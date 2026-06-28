import Papa from "papaparse";

export type Severity = "critical" | "warning" | "info" | string;

export interface QRow {
  row_id: string;
  table_name: string;
  source_file: string;
  source_sheet: string;
  source_row_number: string;
  field_name: string;
  original_value: string;
  cleaned_value: string;
  issue_type: string;
  severity: Severity;
  note: string;
}

export interface SummaryRow {
  table_name: string;
  rows: number;
  columns: number;
  high_confidence_rows: number;
  medium_confidence_rows: number;
  low_confidence_rows: number;
  issue_count: number;
  critical_issue_count: number;
  warning_issue_count: number;
  info_issue_count: number;
}

export interface DQData {
  rows: QRow[];
  summary: SummaryRow[];
  datasets: string[];
  issueTypes: string[];
  severities: string[];
  fields: string[];
}

let cache: Promise<DQData> | null = null;

async function fetchCsv<T>(url: string): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  const text = await res.text();
  return new Promise<T[]>((resolve, reject) => {
    Papa.parse<T>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (r) => resolve(r.data as T[]),
      error: reject,
    });
  });
}

export function loadDataQuality(): Promise<DQData> {
  if (cache) return cache;
  cache = (async () => {
    const [rowsRaw, summaryRaw] = await Promise.all([
      fetchCsv<QRow>("/data/QuestionableData.csv"),
      fetchCsv<Record<string, string>>("/data/SummaryQuestionableData.csv"),
    ]);
    const rows = rowsRaw.filter((r) => r && r.row_id);
    const summary: SummaryRow[] = summaryRaw.map((r) => ({
      table_name: r.table_name,
      rows: Number(r.rows) || 0,
      columns: Number(r.columns) || 0,
      high_confidence_rows: Number(r.high_confidence_rows) || 0,
      medium_confidence_rows: Number(r.medium_confidence_rows) || 0,
      low_confidence_rows: Number(r.low_confidence_rows) || 0,
      issue_count: Number(r.issue_count) || 0,
      critical_issue_count: Number(r.critical_issue_count) || 0,
      warning_issue_count: Number(r.warning_issue_count) || 0,
      info_issue_count: Number(r.info_issue_count) || 0,
    }));
    const uniq = (arr: string[]) =>
      Array.from(new Set(arr.filter((v) => v != null && v !== ""))).sort();
    return {
      rows,
      summary,
      datasets: uniq(rows.map((r) => r.table_name)),
      issueTypes: uniq(rows.map((r) => r.issue_type)),
      severities: uniq(rows.map((r) => r.severity)),
      fields: uniq(rows.map((r) => r.field_name)),
    };
  })();
  return cache;
}

export function severityTone(sev: string): "danger" | "warning" | "info" | "muted" {
  const s = sev.toLowerCase();
  if (s === "critical" || s === "high" || s === "error") return "danger";
  if (s === "warning" || s === "medium" || s === "warn") return "warning";
  if (s === "info" || s === "informational" || s === "low") return "info";
  return "muted";
}

export function severityColorVar(sev: string): string {
  const t = severityTone(sev);
  if (t === "danger") return "var(--danger)";
  if (t === "warning") return "var(--warning)";
  if (t === "info") return "var(--primary)";
  return "var(--muted-foreground)";
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join(
    "\n",
  );
}

export function downloadBlob(filename: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
