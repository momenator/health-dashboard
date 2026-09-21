import type { ColumnMeta, Dataset } from "./types";
import { isEmpty } from "./values";

/** Columns added by the upstream reporting pipeline; never checked as data. */
export const PIPELINE_COLUMNS = new Set([
  "domain",
  "grain",
  "record_id",
  "source_row_id",
  "source_file",
  "source_sheet",
  "source_row_number",
  "year",
  "data_confidence_score",
  "data_confidence_marker",
  "data_quality_issue_count",
  "data_quality_highest_severity",
]);

const ID_CANDIDATES = ["record_id", "patient_key", "case_id", "activity_uid", "worker_id", "id"];
const PERSON_CANDIDATES = [
  "agent",
  "community_agent",
  "staff_responsible",
  "interviewer",
  "enumerator",
  "hq_user",
  "username",
];

export function detectColumns(ds: Dataset): ColumnMeta {
  const has = (c: string) => ds.columns.includes(c);
  let idColumn = ID_CANDIDATES.find(has) ?? null;
  if (!idColumn) {
    idColumn =
      ds.columns.find(
        (c) =>
          /(^|_)id$/i.test(c) &&
          ds.rows.every((r) => !isEmpty(r[c])) &&
          new Set(ds.rows.map((r) => r[c])).size === ds.rows.length,
      ) ?? null;
  }
  let personColumn = PERSON_CANDIDATES.find(has) ?? null;
  if (!personColumn)
    personColumn = ds.columns.find((c) => /agent|staff|enumerator|interviewer/i.test(c)) ?? null;
  const rowNumberColumn = has("source_row_number") ? "source_row_number" : null;
  return { idColumn, personColumn, rowNumberColumn };
}

/** The row number shown to users: the original export row when known, else the CSV line. */
export function rowLabel(ds: Dataset, meta: ColumnMeta, row: number): string {
  if (meta.rowNumberColumn) {
    const v = ds.rows[row][meta.rowNumberColumn];
    if (!isEmpty(v)) return String(v).trim();
  }
  return String(row + 2); // +1 for the header line, +1 for 1-based numbering
}
