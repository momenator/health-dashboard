import { runBuiltinChecks } from "./builtin";
import { detectColumns, PIPELINE_COLUMNS, rowLabel } from "./detect";
import { profileColumns } from "./parse";
import { describeRule, evaluateRule, missingColumns, TYPE_DIMENSION } from "./rules";
import { scoreDimensions } from "./score";
import type {
  Check,
  ColumnStat,
  Dataset,
  DqiResult,
  Issue,
  NotApplicable,
  Rule,
  RuleSet,
} from "./types";

export interface RunOptions {
  /** ISO date treated as today for the future-dates check. Defaults to the current date. */
  today?: string;
}

/** Run every applicable rule and built-in check on a dataset and score it. Pure: no I/O. */
export function runDqi(ds: Dataset, ruleSet: RuleSet, options: RunOptions = {}): DqiResult {
  const meta = detectColumns(ds);
  const label = (r: number) => rowLabel(ds, meta, r);
  const checks: Check[] = [];
  const notApplicable: NotApplicable[] = [];
  const disabled: Rule[] = [];

  for (const rule of ruleSet.rules) {
    if (!rule.enabled) {
      disabled.push(rule);
      continue;
    }
    const missing = missingColumns(rule, ds.columns);
    if (missing.length) {
      notApplicable.push({ rule, missing });
      continue;
    }
    const outcome = evaluateRule(rule, ds, label);
    checks.push({
      id: `rule:${rule.id}`,
      label: rule.label,
      dimension: TYPE_DIMENSION[rule.type],
      severity: "error",
      scored: true,
      source: "rule",
      rule,
      columns: outcome.columns,
      description: describeRule(rule),
      kind: outcome.groups ? "groups" : "rows",
      groups: outcome.groups,
      violations: outcome.violations,
      rows: new Set(),
    });
  }
  const rulesRun = checks.length;

  const profiles = profileColumns(ds);
  const builtinColumns = ds.columns.filter(
    (c) => !PIPELINE_COLUMNS.has(c) && c !== meta.idColumn && c !== meta.rowNumberColumn,
  );
  const builtin = runBuiltinChecks({
    ds,
    profiles,
    settings: ruleSet.builtin,
    columns: builtinColumns,
    label,
    today: options.today ?? new Date().toISOString().slice(0, 10),
  });
  checks.push(...builtin.checks);

  const byRow = new Map<number, Issue[]>();
  for (const check of checks) {
    for (const violation of check.violations) {
      check.rows.add(violation.row);
      const list = byRow.get(violation.row);
      if (list) list.push({ check, violation });
      else byRow.set(violation.row, [{ check, violation }]);
    }
  }

  const columnStats: ColumnStat[] = ds.columns
    .filter((c) => c !== meta.rowNumberColumn)
    .map((column) => {
      const flagged = new Set<number>();
      let errors = 0;
      for (const check of checks)
        for (const v of check.violations)
          if (v.cells.includes(column)) {
            flagged.add(v.row);
            if (check.severity === "error") errors++;
          }
      return { column, missing: profiles[column].missing, flagged: flagged.size, errors };
    });

  const { dimensions, dqi, grade } = scoreDimensions(checks, ds.rows.length);

  return {
    rowCount: ds.rows.length,
    rulesVersion: ruleSet.version,
    meta,
    checks,
    notApplicable,
    disabled,
    byRow,
    dimensions,
    dqi,
    grade,
    columnStats,
    outlierSkipped: builtin.outlierSkipped,
    rulesRun,
  };
}
