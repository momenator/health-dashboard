import type { ColumnMeta, Dataset, DqiResult } from "@/lib/dqi/types";
import { saveFile } from "@/lib/platform";

const XLSX = {
  filterName: "Excel workbook",
  extensions: ["xlsx"],
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const baseName = (name: string) => name.replace(/\.[^.]+$/, "");
const safe = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "");

/** Full 3-sheet report. Returns false if the user cancelled. exceljs is loaded on demand (~1 MB). */
export async function exportWorkbook(
  ds: Dataset,
  result: DqiResult,
  meta: ColumnMeta,
): Promise<boolean> {
  const { buildWorkbook } = await import("@/lib/dqi/excelExport");
  const bytes = await buildWorkbook(ds, result, meta);
  const date = new Date().toISOString().slice(0, 10);
  return saveFile(bytes, { ...XLSX, defaultName: `${baseName(ds.name)}-data-check-${date}.xlsx` });
}

/** One person's flagged records, ready to send to them. */
export async function exportPersonList(
  ds: Dataset,
  result: DqiResult,
  meta: ColumnMeta,
  person: string,
): Promise<boolean> {
  if (!meta.personColumn) return false;
  const { buildWorkbook, rowsForPerson } = await import("@/lib/dqi/excelExport");
  const rows = rowsForPerson(ds, result, meta.personColumn, person);
  const bytes = await buildWorkbook(ds, result, meta, { rows, fullReport: false });
  return saveFile(bytes, {
    ...XLSX,
    defaultName: `${baseName(ds.name)}-issues-${safe(person) || "person"}.xlsx`,
  });
}
