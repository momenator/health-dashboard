import { describe, expect, it } from "vitest";
import { shippedRuleSet } from "@/rules";
import { findVariantGroups, tukeyFence } from "../builtin";
import { detectColumns } from "../detect";
import { runDqi } from "../engine";
import { parseCsv } from "../parse";
import { summarizePeople } from "../people";
import { missingColumns } from "../rules";
import { gradeFor } from "../score";
import { parseRuleSet, ruleSetSchema } from "../schema";
import type { BuiltinSettings, Dataset, Rule, RuleSet } from "../types";
import { isEmpty, quantile, toNum } from "../values";

const NO_BUILTIN: BuiltinSettings = {
  identical: false,
  textInNumbers: false,
  future: false,
  outliers: false,
  k: 3,
  minN: 30,
  spelling: false,
  ignoredColumns: [],
};

function dataset(rows: Array<Record<string, string | number>>): Dataset {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return {
    name: "test.csv",
    columns,
    rows: rows.map((r) =>
      Object.fromEntries(columns.map((c) => [c, r[c] === undefined ? "" : String(r[c])])),
    ),
  };
}

function ruleSet(
  rules: Array<Omit<Rule, "enabled"> & { enabled?: boolean }>,
  builtin: Partial<BuiltinSettings> = {},
): RuleSet {
  return parseRuleSet({ version: "test", rules, builtin: { ...NO_BUILTIN, ...builtin } });
}

function flaggedRows(ds: Dataset, set: RuleSet, checkId: string): number[] {
  const check = runDqi(ds, set, { today: "2026-09-18" }).checks.find((c) => c.id === checkId);
  if (!check) throw new Error(`check ${checkId} did not run`);
  return [...check.rows].sort((a, b) => a - b);
}

describe("values", () => {
  it("treats blanks and CommCare's --- as empty", () => {
    expect(isEmpty("")).toBe(true);
    expect(isEmpty("  ")).toBe(true);
    expect(isEmpty("---")).toBe(true);
    expect(isEmpty("0")).toBe(false);
  });
  it("parses numbers, returning NaN for text", () => {
    expect(toNum(" 4.5 ")).toBe(4.5);
    expect(toNum("")).toBeNull();
    expect(toNum("12kg")).toBeNaN();
  });
  it("uses linear interpolation for quantiles", () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75);
    expect(quantile([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25);
  });
});

describe("rule types", () => {
  it("range: flags out-of-range and non-numeric values, skips empty", () => {
    const ds = dataset([
      { age: 5 },
      { age: 120 },
      { age: "" },
      { age: "abc" },
      { age: -1 },
      { age: 110 },
    ]);
    const set = ruleSet([
      { id: "a", label: "Age", type: "range", params: { column: "age", min: 0, max: 110 } },
    ]);
    expect(flaggedRows(ds, set, "rule:a")).toEqual([1, 3, 4]);
  });

  it("range: works with only a minimum", () => {
    const ds = dataset([{ n: 0 }, { n: 1 }, { n: 99999 }]);
    const set = ruleSet([
      { id: "a", label: "n", type: "range", params: { column: "n", min: 1, max: null } },
    ]);
    expect(flaggedRows(ds, set, "rule:a")).toEqual([0]);
  });

  it("allowed: compares trimmed values exactly (case-sensitive, like ODK codes)", () => {
    const ds = dataset([
      { sex: "female" },
      { sex: " male " },
      { sex: "Male" },
      { sex: "" },
      { sex: "x" },
    ]);
    const set = ruleSet([
      {
        id: "s",
        label: "Sex",
        type: "allowed",
        params: { column: "sex", values: ["female", "male"] },
      },
    ]);
    expect(flaggedRows(ds, set, "rule:s")).toEqual([2, 4]);
  });

  it("compare: checks numeric pairs and skips empties", () => {
    const ds = dataset([
      { a: 1, b: 2 },
      { a: 3, b: 2 },
      { a: "", b: 2 },
      { a: 2, b: 2 },
    ]);
    const set = ruleSet([
      { id: "c", label: "a<=b", type: "compare", params: { a: "a", op: "<=", b: "b" } },
    ]);
    expect(flaggedRows(ds, set, "rule:c")).toEqual([1]);
  });

  it("dateOrder: handles ISO dates and HH:MM times and skips empties", () => {
    const ds = dataset([
      { s: "2025-01-02", e: "2025-01-01" },
      { s: "2025-01-01", e: "2025-01-01" },
      { s: "2025-01-01", e: "" },
      { s: "9:30", e: "10:15" },
      { s: "10:15", e: "09:30" },
    ]);
    const set = ruleSet([
      { id: "d", label: "order", type: "dateOrder", params: { earlier: "s", later: "e" } },
    ]);
    expect(flaggedRows(ds, set, "rule:d")).toEqual([0, 4]);
  });

  it("sum: supports a column or fixed total, tolerance, and skips rows with an empty part", () => {
    const ds = dataset([
      { a: 40, b: 60, t: 100 },
      { a: 40, b: 61, t: 100 },
      { a: 40, b: 60.4, t: 100 },
      { a: "", b: 60, t: 100 },
    ]);
    const col = ruleSet([
      {
        id: "s",
        label: "sum",
        type: "sum",
        params: { parts: ["a", "b"], total: "t", tolerance: 0.5 },
      },
    ]);
    expect(flaggedRows(ds, col, "rule:s")).toEqual([1]);
    const fixed = ruleSet([
      {
        id: "s",
        label: "sum",
        type: "sum",
        params: { parts: ["a", "b"], total: "100", tolerance: 0 },
      },
    ]);
    expect(flaggedRows(ds, fixed, "rule:s")).toEqual([1, 2]);
  });

  it("requiredIf: filled and empty expectations", () => {
    const ds = dataset([
      { res: "tpb_positive", start: "2025-01-01" },
      { res: "tpb_positive", start: "" },
      { res: "negative", start: "" },
      { res: "negative", start: "2025-01-01" },
    ]);
    const filled = ruleSet([
      {
        id: "r",
        label: "r",
        type: "requiredIf",
        params: { when: "res", equals: ["tpb_positive"], then: "start", expect: "filled" },
      },
    ]);
    expect(flaggedRows(ds, filled, "rule:r")).toEqual([1]);
    const empty = ruleSet([
      {
        id: "r",
        label: "r",
        type: "requiredIf",
        params: { when: "res", equals: ["negative"], then: "start", expect: "empty" },
      },
    ]);
    expect(flaggedRows(ds, empty, "rule:r")).toEqual([3]);
  });

  it("required: one violation per empty field; needs every listed column", () => {
    const ds = dataset([
      { a: 1, b: "" },
      { a: "", b: "" },
      { a: 1, b: 2 },
    ]);
    const set = ruleSet([
      { id: "q", label: "q", type: "required", params: { columns: ["a", "b"] } },
    ]);
    const check = runDqi(ds, set).checks.find((c) => c.id === "rule:q")!;
    expect(check.violations).toHaveLength(3);
    expect([...check.rows].sort()).toEqual([0, 1]);

    const partial = ruleSet([
      { id: "q", label: "q", type: "required", params: { columns: ["a", "not_here"] } },
    ]);
    expect(runDqi(ds, partial).notApplicable.map((n) => n.missing)).toEqual([["not_here"]]);
  });

  it("unique: groups duplicates and flags all but the first", () => {
    const ds = dataset([
      { id: "a" },
      { id: "b" },
      { id: "a" },
      { id: "a" },
      { id: "" },
      { id: "" },
    ]);
    const set = ruleSet([{ id: "u", label: "u", type: "unique", params: { column: "id" } }]);
    const check = runDqi(ds, set).checks.find((c) => c.id === "rule:u")!;
    expect(check.groups).toEqual([[0, 2, 3]]);
    expect([...check.rows].sort()).toEqual([2, 3]);
  });

  it("lists rules whose columns are missing as not applicable", () => {
    const ds = dataset([{ age: 5 }]);
    const set = ruleSet([
      { id: "a", label: "a", type: "dateOrder", params: { earlier: "age", later: "nope" } },
      { id: "b", label: "b", type: "required", params: { columns: ["x", "y"] } },
    ]);
    const result = runDqi(ds, set);
    expect(result.notApplicable.map((n) => [n.rule.id, n.missing])).toEqual([
      ["a", ["nope"]],
      ["b", ["x", "y"]],
    ]);
    expect(missingColumns(set.rules[1], ["x"])).toEqual(["y"]);
  });

  it("skips disabled rules", () => {
    const ds = dataset([{ age: 500 }]);
    const set = ruleSet([
      {
        id: "a",
        label: "a",
        type: "range",
        enabled: false,
        params: { column: "age", min: 0, max: 1 },
      },
    ]);
    const result = runDqi(ds, set);
    expect(result.checks).toHaveLength(0);
    expect(result.disabled.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("scoring", () => {
  const ds = dataset([
    { x: 1, y: 1, z: "a" },
    { x: 99, y: 99, z: "a" },
    { x: 1, y: 99, z: "b" },
    { x: 1, y: 1, z: "c" },
  ]);

  it("counts a row once per dimension (prevalence) and tracks intensity", () => {
    const set = ruleSet([
      { id: "x", label: "x", type: "range", params: { column: "x", min: 0, max: 10 } },
      { id: "y", label: "y", type: "range", params: { column: "y", min: 0, max: 10 } },
    ]);
    const r = runDqi(ds, set);
    const v = r.dimensions.Validity;
    expect(v.flagged).toBe(2); // rows 1 and 2; row 1 fails twice but counts once
    expect(v.score).toBe(50);
    expect(v.meanIntensity).toBe(1.5);
  });

  it("leaves unassessed dimensions out of the DQI", () => {
    const set = ruleSet([
      { id: "x", label: "x", type: "range", params: { column: "x", min: 0, max: 10 } },
    ]);
    const r = runDqi(ds, set);
    expect(r.dimensions.Consistency.assessed).toBe(false);
    expect(r.dimensions.Consistency.score).toBeNull();
    expect(r.dqi).toBe(75); // only Validity is assessed
  });

  it("weights Completeness and Conformity at 0", () => {
    const set = ruleSet([
      { id: "x", label: "x", type: "range", params: { column: "x", min: 0, max: 1000 } },
      { id: "q", label: "q", type: "allowed", params: { column: "z", values: ["a"] } },
      { id: "r", label: "r", type: "required", params: { columns: ["z"] } },
      {
        id: "f",
        label: "f",
        type: "requiredIf",
        params: { when: "z", equals: ["b"], then: "x", expect: "empty" },
      },
    ]);
    const withCompleteness = runDqi(
      dataset([
        { x: 1, z: "" },
        { x: 1, z: "b" },
      ]),
      set,
    );
    expect(withCompleteness.dimensions.Completeness.score).toBe(50);
    expect(withCompleteness.dimensions.Conformity.score).toBe(50);
    expect(withCompleteness.dimensions.Validity.score).toBe(50);
    expect(withCompleteness.dqi).toBe(50);
  });

  it("grades on the spec's breakpoints", () => {
    expect(gradeFor(100).label).toBe("Excellent");
    expect(gradeFor(90).label).toBe("Excellent");
    expect(gradeFor(89.99).label).toBe("Good");
    expect(gradeFor(70).label).toBe("Acceptable");
    expect(gradeFor(60).label).toBe("Poor");
    expect(gradeFor(59.9).label).toBe("Critical");
  });
});

describe("built-in checks", () => {
  it("identical rows ignore the ID column and group duplicates", () => {
    const ds = dataset([
      { record_id: "1", a: "x", b: "1" },
      { record_id: "2", a: "x", b: "1" },
      { record_id: "3", a: "y", b: "1" },
    ]);
    const check = runDqi(ds, ruleSet([], { identical: true })).checks.find(
      (c) => c.id === "builtin:identical",
    )!;
    expect(check.groups).toEqual([[0, 1]]);
    expect([...check.rows]).toEqual([1]);
    expect(check.dimension).toBe("Uniqueness");
  });

  it("flags text in a mostly numeric column", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ w: String(40 + i) }));
    rows[3] = { w: "n/a" };
    const ids = flaggedRows(dataset(rows), ruleSet([], { textInNumbers: true }), "builtin:text:w");
    expect(ids).toEqual([3]);
  });

  it("flags dates after today", () => {
    const rows = ["2025-01-01", "2026-09-18", "2026-09-19", "2025-05-05", "2025-06-06"].map(
      (d) => ({ d }),
    );
    expect(flaggedRows(dataset(rows), ruleSet([], { future: true }), "builtin:future")).toEqual([
      2,
    ]);
  });

  it("computes the Tukey fence with the lower bound floored at 0", () => {
    const f = tukeyFence([1, 2, 3, 4, 5, 6, 7, 8], 3);
    expect(f.iqr).toBeCloseTo(3.5);
    expect(f.lo).toBe(0);
    expect(f.hi).toBeCloseTo(6.25 + 10.5);
    const neg = tukeyFence([-10, -5, 0, 5, 10], 1);
    expect(neg.lo).toBeCloseTo(-15);
  });

  it("flags outliers, skips small, constant and ID-like columns", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      amount: String(100 + (i % 10)),
      worker_id: String(i),
      flat: "5",
    }));
    rows[0].amount = "5000";
    const r = runDqi(dataset(rows), ruleSet([], { outliers: true }));
    expect([...r.checks.find((c) => c.id === "builtin:outlier:amount")!.rows]).toEqual([0]);
    expect(r.checks.some((c) => c.id === "builtin:outlier:worker_id")).toBe(false);
    expect(r.checks.some((c) => c.id === "builtin:outlier:flat")).toBe(false);

    const small = runDqi(dataset(rows.slice(0, 20)), ruleSet([], { outliers: true }));
    expect(small.outlierSkipped.find((s) => s.column === "amount")?.reason).toMatch(
      /only 20 values/,
    );

    const ignored = runDqi(
      dataset(rows),
      ruleSet([], { outliers: true, ignoredColumns: ["amount"] }),
    );
    expect(ignored.checks.some((c) => c.id === "builtin:outlier:amount")).toBe(false);
  });

  it("groups spelling variants but not values that differ in digits or are short", () => {
    const values = [
      ...Array(106).fill("gueri"),
      ...Array(95).fill("guerri"),
      ...Array(63).fill("Guéri"),
      ...Array(14).fill("guerrie"),
      "CSB1 Mangolovolo",
      "CSB2 Mangolovolo",
      ...Array(715).fill("Toliara_II"),
      ...Array(40).fill("Toliara_I"),
      ...Array(6).fill("Ankiliabo"),
      ...Array(3).fill("Ankilizato"),
      "male",
      "female",
    ];
    const groups = findVariantGroups(values);
    expect(groups).toHaveLength(1);
    expect(groups[0].canonical).toBe("gueri");
    expect(groups[0].variants.map((v) => v.value)).toEqual(["guerri", "Guéri", "guerrie"]);
  });

  it("does not score spelling variants", () => {
    const rows = [...Array(10).fill("Laparotomie"), "laparotomie", ...Array(10).fill("Hernie")].map(
      (s) => ({ s }),
    );
    const r = runDqi(dataset(rows), ruleSet([], { spelling: true }));
    expect(r.checks.find((c) => c.id === "builtin:spelling")!.rows.size).toBe(1);
    expect(r.dimensions.Validity.assessed).toBe(false);
  });
});

describe("column detection and people", () => {
  it("detects ID, person and row-number columns", () => {
    const ds = dataset([{ record_id: "r1", agent: "Ambo", source_row_number: "2" }]);
    expect(detectColumns(ds)).toEqual({
      idColumn: "record_id",
      personColumn: "agent",
      rowNumberColumn: "source_row_number",
    });
    expect(
      detectColumns(
        dataset([
          { visit_id: "1", staff_name: "x" },
          { visit_id: "2", staff_name: "y" },
        ]),
      ),
    ).toEqual({
      idColumn: "visit_id",
      personColumn: "staff_name",
      rowNumberColumn: null,
    });
  });

  it("summarizes issues per person", () => {
    const ds = dataset([
      { agent: "A", age: 500 },
      { agent: "A", age: 5 },
      { agent: "B", age: 5 },
      { agent: "", age: 900 },
    ]);
    const set = ruleSet([
      { id: "a", label: "Age", type: "range", params: { column: "age", min: 0, max: 110 } },
    ]);
    const people = summarizePeople(ds, runDqi(ds, set), "agent");
    expect(people.map((p) => [p.name, p.records, p.flagged, p.needsFixing])).toEqual([
      ["(not recorded)", 1, 1, 1],
      ["A", 2, 1, 1],
      ["B", 1, 0, 0],
    ]);
  });
});

describe("CSV parsing", () => {
  it("handles BOM, semicolons, quotes and blank headers", () => {
    const ds = parseCsv('﻿name;;note\n"Rakoto";1;"a;b"\n\n', "x.csv");
    expect(ds.columns).toEqual(["name", "column_2", "note"]);
    expect(ds.rows).toEqual([{ name: "Rakoto", column_2: "1", note: "a;b" }]);
  });
  it("rejects files without rows", () => {
    expect(() => parseCsv("a,b\n", "x.csv")).toThrow(/no data rows/);
  });
});

describe("rules.json", () => {
  it("passes the schema", () => {
    expect(ruleSetSchema.safeParse(shippedRuleSet).success).toBe(true);
  });
  it("rejects duplicate ids and empty ranges", () => {
    const dup = ruleSetSchema.safeParse({
      version: "x",
      builtin: NO_BUILTIN,
      rules: [
        { id: "a", label: "a", type: "unique", params: { column: "x" } },
        { id: "a", label: "b", type: "unique", params: { column: "y" } },
      ],
    });
    expect(dup.success).toBe(false);
    const empty = ruleSetSchema.safeParse({
      version: "x",
      builtin: NO_BUILTIN,
      rules: [
        { id: "a", label: "a", type: "range", params: { column: "x", min: null, max: null } },
      ],
    });
    expect(empty.success).toBe(false);
  });
});
