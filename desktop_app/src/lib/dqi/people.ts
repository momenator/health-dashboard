import type { Dataset, DqiResult } from "./types";
import { isEmpty } from "./values";

export const NOT_RECORDED = "(not recorded)";

export interface PersonSummary {
  name: string;
  records: number;
  flagged: number;
  needsFixing: number;
  /** Most frequent issue: [check label, count]. */
  topIssue: [string, number] | null;
  byCheck: Map<string, number>;
}

export function personOf(ds: Dataset, column: string, row: number): string {
  const v = ds.rows[row][column];
  return isEmpty(v) ? NOT_RECORDED : String(v).trim();
}

/**
 * Group results by the person who entered each row. Grouping only; the
 * column choice never affects the score.
 */
export function summarizePeople(ds: Dataset, result: DqiResult, column: string): PersonSummary[] {
  const people = new Map<string, PersonSummary>();
  ds.rows.forEach((_, r) => {
    const name = personOf(ds, column, r);
    let p = people.get(name);
    if (!p) {
      p = { name, records: 0, flagged: 0, needsFixing: 0, topIssue: null, byCheck: new Map() };
      people.set(name, p);
    }
    p.records++;
    const issues = result.byRow.get(r);
    if (!issues) return;
    p.flagged++;
    if (issues.some((i) => i.check.severity === "error")) p.needsFixing++;
    for (const i of issues) p.byCheck.set(i.check.label, (p.byCheck.get(i.check.label) ?? 0) + 1);
  });
  for (const p of people.values())
    p.topIssue = [...p.byCheck.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  return [...people.values()].sort(
    (a, b) =>
      b.needsFixing - a.needsFixing || b.flagged - a.flagged || a.name.localeCompare(b.name),
  );
}
