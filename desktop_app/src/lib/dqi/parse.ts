import Papa from "papaparse";
import type { Dataset, Row } from "./types";
import { DATE_RE, isEmpty } from "./values";

export class CsvError extends Error {}

/** Parse CSV text (comma, semicolon or tab separated; delimiter is auto-detected). */
export function parseCsv(text: string, name: string): Dataset {
  const clean = text.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Row>(clean, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h, i) => h.trim() || `column_${i + 1}`,
  });
  const columns = (parsed.meta.fields ?? []).filter(Boolean);
  if (!columns.length) throw new CsvError("The file has no header row.");
  const rows = parsed.data.map((r) => {
    const row: Row = {};
    for (const c of columns) row[c] = r[c] == null ? "" : String(r[c]);
    return row;
  });
  if (!rows.length) throw new CsvError("The file has a header row but no data rows.");
  return { name, columns, rows };
}

export interface ColumnProfile {
  missing: number;
  filled: number;
  /** ≥ 90% of filled values are numbers (and at least 5 values). */
  numeric: boolean;
  /** ≥ 90% of filled values start with an ISO date (and at least 5 values). */
  date: boolean;
  distinct: number;
  values: string[];
  numbers: number[];
}

export function profileColumns(ds: Dataset): Record<string, ColumnProfile> {
  const out: Record<string, ColumnProfile> = {};
  for (const c of ds.columns) {
    const values: string[] = [];
    let missing = 0;
    for (const row of ds.rows) {
      const v = row[c];
      if (isEmpty(v)) missing++;
      else values.push(String(v).trim());
    }
    const numbers = values.map(Number).filter(Number.isFinite);
    const dates = values.filter((v) => DATE_RE.test(v)).length;
    out[c] = {
      missing,
      filled: values.length,
      numeric: values.length >= 5 && numbers.length / values.length >= 0.9,
      date: values.length >= 5 && dates / values.length >= 0.9,
      distinct: new Set(values).size,
      values,
      numbers,
    };
  }
  return out;
}
