import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shippedRuleSet } from "@/rules";
import { runDqi } from "../engine";
import { parseCsv } from "../parse";
import type { DqiResult } from "../types";

// Real DfM reporting tables. uploaded_donnees_export_2026_06_28.csv is left
// out on purpose: the old PII step replaced its dates and decimals.
const DATA_DIR = path.resolve(import.meta.dirname, "../../../../../data/reporting");

function run(file: string): DqiResult {
  const ds = parseCsv(fs.readFileSync(path.join(DATA_DIR, file), "utf8"), file);
  return runDqi(ds, shippedRuleSet, { today: "2026-09-18" });
}

function counts(result: DqiResult): Record<string, number> {
  return Object.fromEntries(result.checks.map((c) => [c.id, c.rows.size]));
}

describe("mchp_patient_support.csv", () => {
  const r = run("mchp_patient_support.csv");
  const c = counts(r);
  it("detects the key columns", () => {
    expect(r.rowCount).toBe(2075);
    expect(r.meta).toEqual({
      idColumn: "record_id",
      personColumn: "agent",
      rowNumberColumn: "source_row_number",
    });
  });
  it("finds the known rule violations", () => {
    expect(c["rule:mchp-discharge-order"]).toBe(206);
    expect(c["rule:mchp-amounts"]).toBe(9);
    expect(c["rule:mchp-shares"]).toBe(6);
    expect(c["rule:mchp-required"]).toBe(5);
    expect(c["rule:age-range"]).toBe(0);
    expect(c["rule:household-size"]).toBe(0);
    expect(c["rule:mchp-surgery"]).toBe(0);
  });
  it("only runs MCHP and shared rules", () => {
    expect(c["rule:tb-required"]).toBeUndefined();
    expect(r.notApplicable.map((n) => n.rule.id)).toContain("tb-start-order");
  });
  it("finds spelling variants such as gueri / guerri", () => {
    const spelling = r.checks.find((x) => x.id === "builtin:spelling")!;
    const evolution = spelling.variantGroups!.find(
      (g) => g.column === "clinical_evolution" && g.canonical === "gueri",
    );
    expect(evolution?.variants.map((v) => v.value)).toEqual(
      expect.arrayContaining(["guerri", "Guéri"]),
    );
  });
});

describe("tb_patient_journey.csv", () => {
  const r = run("tb_patient_journey.csv");
  const c = counts(r);
  it("detects the key columns", () => {
    expect(r.rowCount).toBe(4495);
    expect(r.meta.personColumn).toBe("community_agent");
  });
  it("finds the known rule violations", () => {
    expect(c["rule:tb-start-order"]).toBe(15);
    expect(c["rule:tb-result-order"]).toBe(57);
    expect(c["rule:tb-final-order"]).toBe(23);
    expect(c["rule:tb-positive-treated"]).toBe(32);
    expect(c["rule:tb-bmi"]).toBe(23);
    expect(c["rule:tb-required"]).toBe(124);
    expect(c["rule:tb-weight"]).toBe(0);
    expect(c["rule:tb-height"]).toBe(0);
  });
  it("flags many heights as unusual (a known false-positive pattern)", () => {
    expect(c["builtin:outlier:height_m"]).toBe(177);
  });
  it("only runs TB and shared rules", () => {
    expect(c["rule:mchp-required"]).toBeUndefined();
  });
});

describe("other tables", () => {
  it("sensitization: participant sums are consistent", () => {
    const c = counts(run("sensitization_activities.csv"));
    expect(c["rule:sens-sex-sum"]).toBe(0);
    expect(c["rule:sens-age-sum"]).toBe(0);
    expect(c["rule:sens-time-order"]).toBe(0);
  });
  it("community workers: 2 identical rows", () => {
    const r = run("community_workers.csv");
    expect(counts(r)["builtin:identical"]).toBe(2);
    expect(r.meta.personColumn).toBeNull();
  });
  it("ambulance causes: 22 identical rows, no numeric outlier checks", () => {
    const r = run("ambulance_causes.csv");
    expect(counts(r)["builtin:identical"]).toBe(22);
    expect(r.dimensions.Plausibility.assessed).toBe(false);
  });
  it("ambulance trips: trip legs add up", () => {
    const c = counts(run("ambulance_trips.csv"));
    expect(c["rule:amb-durations"]).toBe(0);
    expect(c["rule:amb-distance"]).toBe(0);
  });
});
