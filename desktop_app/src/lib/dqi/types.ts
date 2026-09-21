import type { BuiltinSettings, Rule } from "./schema";

export type { BuiltinSettings, CompareOp, Rule, RuleSet, RuleType } from "./schema";

export type Row = Record<string, string>;

export interface Dataset {
  name: string;
  columns: string[];
  rows: Row[];
}

export type Dimension =
  "Uniqueness" | "Consistency" | "Validity" | "Plausibility" | "Completeness" | "Conformity";

/** "error" = needs fixing (a rule was broken); "review" = worth a look (often a correct value). */
export type Severity = "error" | "review";

/** Text with inline column names / values, rendered as code in the UI and plain in Excel. */
export type RichText = Array<string | { code: string }>;

export interface Violation {
  /** Index into dataset.rows. */
  row: number;
  /** Columns involved; all of them are highlighted. */
  cells: string[];
  message: string;
  /** Set on spelling-variant violations so the UI can filter by variant. */
  variant?: { column: string; value: string };
}

export interface VariantGroup {
  column: string;
  canonical: string;
  canonicalCount: number;
  variants: Array<{ value: string; count: number }>;
}

export type BuiltinKey = keyof Pick<
  BuiltinSettings,
  "identical" | "textInNumbers" | "future" | "outliers" | "spelling"
>;

export interface Check {
  id: string;
  label: string;
  dimension: Dimension;
  severity: Severity;
  /** Whether the check counts toward its dimension's score. */
  scored: boolean;
  source: "rule" | "builtin";
  rule?: Rule;
  builtin?: BuiltinKey;
  /** For per-column outlier checks: the column that can be ignored. */
  ignoreColumn?: string;
  columns: string[];
  description: RichText;
  /** "groups": duplicates, shown together. "variants": spelling groups. */
  kind: "rows" | "groups" | "variants";
  groups?: number[][];
  variantGroups?: VariantGroup[];
  violations: Violation[];
  /** Distinct rows with at least one violation. */
  rows: Set<number>;
}

export interface NotApplicable {
  rule: Rule;
  missing: string[];
}

export interface DimensionScore {
  dimension: Dimension;
  weight: number;
  assessed: boolean;
  checks: number;
  flagged: number;
  score: number | null;
  /** Mean number of failed checks among flagged rows (Consistency, Validity, Plausibility). */
  meanIntensity: number | null;
}

export interface Grade {
  label: "Excellent" | "Good" | "Acceptable" | "Poor" | "Critical";
  min: number;
}

export interface Issue {
  check: Check;
  violation: Violation;
}

export interface ColumnStat {
  column: string;
  missing: number;
  flagged: number;
  errors: number;
}

export interface ColumnMeta {
  idColumn: string | null;
  personColumn: string | null;
  rowNumberColumn: string | null;
}

export interface DqiResult {
  rowCount: number;
  rulesVersion: string;
  meta: ColumnMeta;
  checks: Check[];
  notApplicable: NotApplicable[];
  /** Rules turned off in rules.json. */
  disabled: Rule[];
  byRow: Map<number, Issue[]>;
  dimensions: Record<Dimension, DimensionScore>;
  dqi: number | null;
  grade: Grade | null;
  columnStats: ColumnStat[];
  outlierSkipped: Array<{ column: string; reason: string }>;
  rulesRun: number;
}
