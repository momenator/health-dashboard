import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Dataset, Row } from "./types";
import { DATE_RE, isEmpty } from "./values";

export class CsvError extends Error {}
export class ExcelError extends Error {}

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

/** Parse the first worksheet of an .xls or .xlsx workbook. */
export function parseExcel(data: ArrayBuffer, name: string): Dataset {
  try {
    const workbook = XLSX.read(data, { type: "array", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new ExcelError("The workbook has no worksheets.");

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });
    const header = rows[0];
    if (!header?.length) throw new ExcelError("The first worksheet has no header row.");

    const columns = header.map((value, index) => String(value).trim() || `column_${index + 1}`);
    const dataRows = rows.slice(1).filter((row) => row.some((value) => String(value).trim()));
    if (!dataRows.length)
      throw new ExcelError("The first worksheet has a header row but no data rows.");

    return {
      name,
      columns,
      rows: dataRows.map((values) => {
        const row: Row = {};
        for (const [index, column] of columns.entries()) row[column] = String(values[index] ?? "");
        return row;
      }),
    };
  } catch (error) {
    if (error instanceof ExcelError) throw error;
    throw new ExcelError("The workbook couldn't be read.");
  }
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
