import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { shippedRuleSet } from "@/rules";
import { runDqi } from "../engine";
import { buildWorkbook, rowsForPerson } from "../excelExport";
import { parseCsv } from "../parse";

const file = path.resolve(
  import.meta.dirname,
  "../../../../../data/reporting/mchp_patient_support.csv",
);
const ds = parseCsv(fs.readFileSync(file, "utf8"), "mchp_patient_support.csv");
const result = runDqi(ds, shippedRuleSet, { today: "2026-09-18" });

async function load(bytes: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer as ArrayBuffer);
  return wb;
}

describe("Excel export", () => {
  it("writes the three sheets from the spec", async () => {
    const wb = await load(await buildWorkbook(ds, result, result.meta));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Scores",
      "Issues per record",
      "Issues per person",
    ]);

    const scores = wb.getWorksheet("Scores")!;
    expect(scores.getRow(3).values).toContain(shippedRuleSet.version);

    const records = wb.getWorksheet("Issues per record")!;
    expect(records.rowCount).toBe(result.byRow.size + 1);
    // A discharge-before-inclusion row has both date cells coloured red.
    const header = (records.getRow(1).values as string[]).slice(1);
    const incl = header.indexOf("inclusion_date") + 1;
    const disc = header.indexOf("discharge_date") + 1;
    const check = result.checks.find((c) => c.id === "rule:mchp-discharge-order")!;
    const firstRow =
      [...result.byRow.keys()]
        .sort((a, b) => a - b)
        .indexOf([...check.rows].sort((a, b) => a - b)[0]) + 2;
    const fill = (c: number) =>
      (records.getRow(firstRow).getCell(c).fill as ExcelJS.FillPattern).fgColor?.argb;
    expect(fill(incl)).toBe("FFFBE1DE");
    expect(fill(disc)).toBe("FFFBE1DE");

    const people = wb.getWorksheet("Issues per person")!;
    expect(people.getRow(1).getCell(1).value).toBe("agent");
  });

  it("exports one person's list as a single sheet", async () => {
    const rows = rowsForPerson(ds, result, "agent", "Ambo");
    expect(rows.length).toBeGreaterThan(0);
    const wb = await load(
      await buildWorkbook(ds, result, result.meta, { rows, fullReport: false }),
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Issues per record"]);
    expect(wb.getWorksheet("Issues per record")!.rowCount).toBe(rows.length + 1);
  });
});
