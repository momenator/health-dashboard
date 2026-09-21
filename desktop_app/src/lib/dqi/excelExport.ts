import ExcelJS from "exceljs";
import { rowLabel } from "./detect";
import { personOf, summarizePeople } from "./people";
import { DIMENSIONS, INTENSITY_DIMENSIONS } from "./score";
import type { ColumnMeta, Dataset, DqiResult, Issue } from "./types";

// Spec §4: Sheet 1 scores, Sheet 2 issues per record, Sheet 3 issues per person.

const FILL = {
  err: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBE1DE" } },
  rev: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF1C8" } },
  head: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9EEF3" } },
} satisfies Record<string, ExcelJS.Fill>;

export interface ExportOptions {
  /** Only these rows (e.g. one person's records). Default: every flagged row. */
  rows?: number[];
  /** Include the scores and per-person sheets. Default true. */
  fullReport?: boolean;
  /** Shown on the scores sheet. */
  checkedAt?: Date;
}

export async function buildWorkbook(
  ds: Dataset,
  result: DqiResult,
  meta: ColumnMeta,
  opts: ExportOptions = {},
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DfM Data Check";
  wb.created = opts.checkedAt ?? new Date();
  const full = opts.fullReport ?? true;
  if (full) scoresSheet(wb, ds, result, opts.checkedAt ?? new Date());
  recordsSheet(wb, ds, result, meta, opts.rows ?? [...result.byRow.keys()].sort((a, b) => a - b));
  if (full) peopleSheet(wb, ds, result, meta);
  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

function header(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((c) => (c.fill = FILL.head));
}

function scoresSheet(wb: ExcelJS.Workbook, ds: Dataset, result: DqiResult, checkedAt: Date) {
  const ws = wb.addWorksheet("Scores");
  ws.columns = [
    { width: 44 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 10 },
  ];
  const kv: Array<[string, string | number]> = [
    ["File", ds.name],
    ["Checked on", checkedAt.toISOString().slice(0, 16).replace("T", " ")],
    ["Rules version", result.rulesVersion],
    ["Records", result.rowCount],
    ["Data Quality Index", result.dqi === null ? "n/a" : round(result.dqi)],
    ["Grade", result.grade?.label ?? "n/a"],
  ];
  for (const [k, v] of kv) ws.addRow([k, v]).getCell(1).font = { bold: true };

  ws.addRow([]);
  header(
    ws.addRow(["Dimension", "Score", "Weight", "Flagged records", "Mean intensity", "Checks"]),
  );
  for (const { dimension, weight } of DIMENSIONS) {
    const d = result.dimensions[dimension];
    ws.addRow([
      dimension,
      d.score === null ? "n/a" : round(d.score),
      weight ? `${weight}%` : "reported only",
      d.flagged,
      INTENSITY_DIMENSIONS.includes(dimension) && d.meanIntensity !== null
        ? round(d.meanIntensity)
        : "",
      d.checks,
    ]);
  }

  ws.addRow([]);
  header(ws.addRow(["Check", "Dimension", "Severity", "Rows flagged", "Scored", "Source"]));
  const sorted = [...result.checks].sort((a, b) => b.rows.size - a.rows.size);
  for (const c of sorted)
    ws.addRow([
      c.label,
      c.dimension,
      c.severity === "error" ? "Needs fixing" : "Worth a look",
      c.rows.size,
      c.scored ? "yes" : "no",
      c.rule ? `rule ${c.rule.id}` : "built-in",
    ]);

  if (result.notApplicable.length) {
    ws.addRow([]);
    header(ws.addRow(["Rule not applied (missing columns)", "Missing"]));
    for (const n of result.notApplicable) ws.addRow([n.rule.label, n.missing.join(", ")]);
  }
}

function recordsSheet(
  wb: ExcelJS.Workbook,
  ds: Dataset,
  result: DqiResult,
  meta: ColumnMeta,
  rows: number[],
) {
  const ws = wb.addWorksheet("Issues per record");
  const lead = [
    "Row",
    ...(meta.idColumn ? [meta.idColumn] : []),
    ...(meta.personColumn ? [meta.personColumn] : []),
  ];
  const counts = DIMENSIONS.map((d) => d.dimension);
  const dataCols = ds.columns.filter((c) => c !== meta.idColumn && c !== meta.personColumn);
  const head = [
    ...lead,
    "Issues",
    ...counts.map((d) => `${d} issues`),
    "What to check",
    ...dataCols,
  ];
  header(ws.addRow(head));
  ws.views = [{ state: "frozen", xSplit: lead.length, ySplit: 1 }];
  ws.getColumn(head.indexOf("What to check") + 1).width = 70;
  lead.forEach((_, i) => (ws.getColumn(i + 1).width = i === 0 ? 8 : 26));
  const dataStart = head.length - dataCols.length + 1;
  dataCols.forEach((_, i) => (ws.getColumn(dataStart + i).width = 18));

  for (const r of rows) {
    const issues: Issue[] = result.byRow.get(r) ?? [];
    const row = ds.rows[r];
    const excelRow = ws.addRow([
      rowLabel(ds, meta, r),
      ...(meta.idColumn ? [row[meta.idColumn]] : []),
      ...(meta.personColumn ? [row[meta.personColumn]] : []),
      issues.length,
      ...counts.map((d) => issues.filter((i) => i.check.dimension === d).length),
      issues.map((i) => `${i.check.label}: ${i.violation.message}`).join("\n"),
      ...dataCols.map((c) => row[c]),
    ]);
    excelRow.getCell(head.indexOf("What to check") + 1).alignment = {
      wrapText: true,
      vertical: "top",
    };
    // Colour the offending cells: red = needs fixing, amber = worth a look.
    const severity = new Map<string, "error" | "review">();
    for (const i of issues)
      for (const c of i.violation.cells)
        if (severity.get(c) !== "error") severity.set(c, i.check.severity);
    for (const [c, s] of severity) {
      const idx = head.indexOf(c);
      if (idx >= 0) excelRow.getCell(idx + 1).fill = s === "error" ? FILL.err : FILL.rev;
    }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: head.length } };
}

function peopleSheet(wb: ExcelJS.Workbook, ds: Dataset, result: DqiResult, meta: ColumnMeta) {
  const ws = wb.addWorksheet("Issues per person");
  if (!meta.personColumn) {
    ws.addRow([
      "This file has no column for who entered each row, so issues can't be grouped by person.",
    ]);
    return;
  }
  const people = summarizePeople(ds, result, meta.personColumn);
  const checkLabels = [...new Set(result.checks.filter((c) => c.rows.size).map((c) => c.label))];
  const head = [
    meta.personColumn,
    "Records",
    "Flagged records",
    "Need fixing",
    "% flagged",
    ...checkLabels,
  ];
  header(ws.addRow(head));
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  ws.getColumn(1).width = 28;
  for (const p of people)
    ws.addRow([
      p.name,
      p.records,
      p.flagged,
      p.needsFixing,
      round((p.flagged / p.records) * 100),
      ...checkLabels.map((l) => p.byCheck.get(l) ?? 0),
    ]);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: head.length } };
}

/** Flagged rows entered by one person, for "Export this list". */
export function rowsForPerson(
  ds: Dataset,
  result: DqiResult,
  personColumn: string,
  name: string,
): number[] {
  return [...result.byRow.keys()]
    .filter((r) => personOf(ds, personColumn, r) === name)
    .sort((a, b) => a - b);
}

function round(x: number): number {
  return Math.round(x * 10) / 10;
}
