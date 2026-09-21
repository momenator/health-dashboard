import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseCsv, parseExcel } from "../parse";

function workbookBytes(bookType: "xls" | "xlsx"): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["name", "score"],
    ["Amina", 12],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Data");
  const bytes = XLSX.write(workbook, { bookType, type: "array" });
  return bytes instanceof ArrayBuffer
    ? bytes
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe("file parsing", () => {
  it("keeps CSV parsing in the shared dataset format", () => {
    expect(parseCsv("name,score\nAmina,12", "data.csv")).toEqual({
      name: "data.csv",
      columns: ["name", "score"],
      rows: [{ name: "Amina", score: "12" }],
    });
  });

  it.each(["xls", "xlsx"] as const)("parses .%s workbooks", (bookType) => {
    expect(parseExcel(workbookBytes(bookType), `data.${bookType}`)).toEqual({
      name: `data.${bookType}`,
      columns: ["name", "score"],
      rows: [{ name: "Amina", score: "12" }],
    });
  });
});
