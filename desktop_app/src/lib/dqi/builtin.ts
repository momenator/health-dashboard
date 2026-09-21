import type { ColumnProfile } from "./parse";
import type { BuiltinSettings, Check, Dataset, VariantGroup, Violation } from "./types";
import { DATE_RE, fmt, levenshtein, normalizeText, quantile, toNum } from "./values";

/** Numeric columns whose names suggest identifiers or codes are not outlier-checked. */
const ID_LIKE =
  /(^|_)(id|uuid|key|number|code|gps|lat|lon|latitude|longitude|phone|year|month|quarter)$/i;

export interface BuiltinContext {
  ds: Dataset;
  profiles: Record<string, ColumnProfile>;
  settings: BuiltinSettings;
  /** Columns checked by built-in checks (pipeline, ID and row-number columns removed). */
  columns: string[];
  label: (row: number) => string;
  /** ISO date (YYYY-MM-DD) that counts as "today". */
  today: string;
}

export interface BuiltinOutcome {
  checks: Check[];
  outlierSkipped: Array<{ column: string; reason: string }>;
}

function check(partial: Omit<Check, "rows">): Check {
  return { ...partial, rows: new Set() };
}

export function runBuiltinChecks(ctx: BuiltinContext): BuiltinOutcome {
  const { settings } = ctx;
  const checks: Check[] = [];
  let outlierSkipped: BuiltinOutcome["outlierSkipped"] = [];
  if (settings.identical) checks.push(identicalRows(ctx));
  if (settings.textInNumbers) checks.push(...textInNumbers(ctx));
  if (settings.future) {
    const c = futureDates(ctx);
    if (c) checks.push(c);
  }
  if (settings.outliers) {
    const o = outliers(ctx);
    checks.push(...o.checks);
    outlierSkipped = o.skipped;
  }
  if (settings.spelling) checks.push(spellingVariants(ctx));
  return { checks, outlierSkipped };
}

function identicalRows({ ds, columns, label }: BuiltinContext): Check {
  const seen = new Map<string, number[]>();
  ds.rows.forEach((row, r) => {
    const values = columns.map((c) => row[c] ?? "");
    if (values.every((v) => v.trim() === "")) return;
    const key = values.join("␟");
    const list = seen.get(key);
    if (list) list.push(r);
    else seen.set(key, [r]);
  });
  const groups = [...seen.values()].filter((g) => g.length > 1);
  const violations: Violation[] = [];
  for (const g of groups)
    for (const r of g.slice(1))
      violations.push({ row: r, cells: [], message: `Same as row ${label(g[0])} in every field` });
  return check({
    id: "builtin:identical",
    label: "Identical rows",
    dimension: "Uniqueness",
    severity: "review",
    scored: true,
    source: "builtin",
    builtin: "identical",
    columns: [],
    kind: "groups",
    groups,
    description: [
      "Rows where every field (apart from the row ID and row number) is the same. They can be real repeat events or double entry.",
    ],
    violations,
  });
}

function textInNumbers({ ds, profiles, columns }: BuiltinContext): Check[] {
  const out: Check[] = [];
  for (const c of columns) {
    const p = profiles[c];
    if (!p.numeric || p.numbers.length === p.filled) continue;
    const violations: Violation[] = [];
    ds.rows.forEach((row, r) => {
      if (Number.isNaN(toNum(row[c])))
        violations.push({ row: r, cells: [c], message: `“${row[c]}” in a number column` });
    });
    out.push(
      check({
        id: `builtin:text:${c}`,
        label: `Text in number column ${c}`,
        dimension: "Validity",
        severity: "error",
        scored: true,
        source: "builtin",
        builtin: "textInNumbers",
        columns: [c],
        kind: "rows",
        description: ["Most values in ", { code: c }, " are numbers; these are not."],
        violations,
      }),
    );
  }
  return out;
}

function futureDates({ ds, profiles, columns, today }: BuiltinContext): Check | null {
  const dateCols = columns.filter((c) => profiles[c].date);
  if (!dateCols.length) return null;
  const violations: Violation[] = [];
  ds.rows.forEach((row, r) => {
    for (const c of dateCols) {
      const v = String(row[c] ?? "").trim();
      if (DATE_RE.test(v) && v.slice(0, 10) > today)
        violations.push({ row: r, cells: [c], message: `${c} ${v} is in the future` });
    }
  });
  return check({
    id: "builtin:future",
    label: "Dates in the future",
    dimension: "Validity",
    severity: "error",
    scored: true,
    source: "builtin",
    builtin: "future",
    columns: dateCols,
    kind: "rows",
    description: [
      `Any date after today (${today}) in ${dateCols.length} date column${dateCols.length > 1 ? "s" : ""}.`,
    ],
    violations,
  });
}

/** Tukey fence per spec §3.6: [max(Q1 − k·IQR, 0), Q3 + k·IQR]. */
export function tukeyFence(values: number[], k: number): { lo: number; hi: number; iqr: number } {
  const s = [...values].sort((a, b) => a - b);
  const q1 = quantile(s, 0.25);
  const q3 = quantile(s, 0.75);
  const iqr = q3 - q1;
  let lo = q1 - k * iqr;
  // Floor at 0 when negatives never occur (counts, costs, sizes).
  if (s[0] >= 0) lo = Math.max(lo, 0);
  return { lo, hi: q3 + k * iqr, iqr };
}

function outliers({ ds, profiles, columns, settings }: BuiltinContext) {
  const checks: Check[] = [];
  const skipped: BuiltinOutcome["outlierSkipped"] = [];
  const ignored = new Set(settings.ignoredColumns);
  for (const c of columns) {
    const p = profiles[c];
    if (!p.numeric || ignored.has(c) || ID_LIKE.test(c)) continue;
    if (p.numbers.length < settings.minN) {
      skipped.push({
        column: c,
        reason: `only ${p.numbers.length} values (needs ${settings.minN})`,
      });
      continue;
    }
    if (new Set(p.numbers).size <= 5) continue;
    const { lo, hi, iqr } = tukeyFence(p.numbers, settings.k);
    if (iqr === 0) {
      skipped.push({ column: c, reason: "most values are identical" });
      continue;
    }
    const violations: Violation[] = [];
    ds.rows.forEach((row, r) => {
      const x = toNum(row[c]);
      if (x === null || Number.isNaN(x)) return;
      if (x < lo || x > hi)
        violations.push({
          row: r,
          cells: [c],
          message: `${fmt(x)} is ${x > hi ? "above" : "below"} the usual range ${fmt(lo)}–${fmt(hi)}`,
        });
    });
    checks.push(
      check({
        id: `builtin:outlier:${c}`,
        label: `Unusual ${c}`,
        dimension: "Plausibility",
        severity: "review",
        scored: true,
        source: "builtin",
        builtin: "outliers",
        ignoreColumn: c,
        columns: [c],
        kind: "rows",
        description: [
          `Values outside ${fmt(lo)} – ${fmt(hi)}. This range is worked out from the file itself (Tukey fence, ${settings.k}× the spread of the middle half, ${p.numbers.length} values). Skewed columns such as costs or distances can flag correct values.`,
        ],
        violations,
      }),
    );
  }
  return { checks, skipped };
}

const ROMAN: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
};

/**
 * The numbers in a value, counting Roman-numeral words ("Toliara_II", "Zone I")
 * as numbers. Values whose numbers differ are never merged.
 */
function numberSignature(value: string): string {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((tok) => ROMAN[tok] ?? tok.replace(/\D/g, ""))
    .filter(Boolean)
    .join(",");
}

/**
 * Group values that differ only in case, accents, punctuation or one or two
 * letters. Values with different numbers are never merged (CSB1 vs CSB2,
 * Toliara_I vs Toliara_II). A two-letter difference only merges when one
 * spelling is rare (≤ 20% of the other), so similar place names stay apart.
 */
export function findVariantGroups(values: string[]): Array<{
  canonical: string;
  canonicalCount: number;
  variants: Array<{ value: string; count: number }>;
}> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const byKey = new Map<string, Array<[string, number]>>();
  for (const [v, n] of counts) {
    const k = normalizeText(v);
    if (!k) continue;
    const list = byKey.get(k);
    if (list) list.push([v, n]);
    else byKey.set(k, [[v, n]]);
  }
  const keys = [...byKey.keys()];
  const keyCount = keys.map((k) => byKey.get(k)!.reduce((s, [, n]) => s + n, 0));
  const signature = keys.map((k) => numberSignature(byKey.get(k)![0][0]));
  const parent = keys.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      const minLen = Math.min(a.length, b.length);
      if (minLen < 5 || signature[i] !== signature[j]) continue;
      const d = levenshtein(a, b, 2);
      const rare = Math.min(keyCount[i], keyCount[j]) <= 0.2 * Math.max(keyCount[i], keyCount[j]);
      if (d <= 1 || (d === 2 && minLen >= 8 && rare)) parent[find(i)] = find(j);
    }
  }
  const clusters = new Map<number, Array<[string, number]>>();
  keys.forEach((k, i) => {
    const root = find(i);
    const list = clusters.get(root) ?? [];
    list.push(...byKey.get(k)!);
    clusters.set(root, list);
  });
  const groups = [];
  for (const members of clusters.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    groups.push({
      canonical: members[0][0],
      canonicalCount: members[0][1],
      variants: members.slice(1).map(([value, count]) => ({ value, count })),
    });
  }
  return groups;
}

function spellingVariants({ ds, profiles, columns, settings }: BuiltinContext): Check {
  const ignored = new Set(settings.ignoredColumns);
  const variantGroups: VariantGroup[] = [];
  const violations: Violation[] = [];
  for (const c of columns) {
    const p = profiles[c];
    if (p.numeric || p.date || ignored.has(c)) continue;
    if (p.distinct < 2 || p.distinct > 300 || p.distinct / Math.max(p.filled, 1) > 0.8) continue;
    for (const g of findVariantGroups(p.values)) {
      variantGroups.push({ column: c, ...g });
      const variantSet = new Set(g.variants.map((v) => v.value));
      ds.rows.forEach((row, r) => {
        const v = String(row[c] ?? "").trim();
        if (variantSet.has(v))
          violations.push({
            row: r,
            cells: [c],
            message: `“${v}” looks like a spelling of “${g.canonical}” (${g.canonicalCount} rows)`,
            variant: { column: c, value: v },
          });
      });
    }
  }
  const variantTotal = (g: VariantGroup) => g.variants.reduce((s, v) => s + v.count, 0);
  variantGroups.sort((a, b) => variantTotal(b) - variantTotal(a));
  return check({
    id: "builtin:spelling",
    label: "Spelling variants",
    dimension: "Validity",
    severity: "review",
    scored: false,
    source: "builtin",
    builtin: "spelling",
    columns: [...new Set(variantGroups.map((g) => g.column))],
    kind: "variants",
    variantGroups,
    description: [
      "Values that differ only in capitals, accents or a letter or two. Usually the same answer typed differently, which splits counts in charts and tables. Not part of the score.",
    ],
    violations,
  });
}
