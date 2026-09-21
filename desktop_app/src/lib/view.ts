import { personOf } from "@/lib/dqi/people";
import type { Check, ColumnMeta, Dataset, DqiResult, Issue } from "@/lib/dqi/types";
import type { Selection } from "@/store/app";

export type TableEntry =
  { type: "group"; size: number } | { type: "row"; row: number; issues: Issue[]; base: boolean };

export interface DetailView {
  check: Check | null;
  entries: TableEntry[];
  /** Columns to show besides row number, ID and person. */
  focusColumns: string[];
  /** Distinct flagged rows in this view. */
  flaggedRows: number;
}

/** Everything the flagged-rows table needs for the current selection. */
export function buildDetailView(
  ds: Dataset,
  result: DqiResult,
  meta: ColumnMeta,
  sel: Selection,
  variant: { column: string; value: string } | null,
): DetailView | null {
  const byRow = new Map<number, Issue[]>();
  const push = (row: number, issue: Issue) => {
    const list = byRow.get(row);
    if (list) list.push(issue);
    else byRow.set(row, [issue]);
  };
  let check: Check | null = null;
  let focus: string[] = [];

  if (sel.kind === "check") {
    check = result.checks.find((c) => c.id === sel.id) ?? null;
    if (!check) return null;
    for (const violation of check.violations) {
      if (
        variant &&
        (violation.variant?.column !== variant.column || violation.variant.value !== variant.value)
      )
        continue;
      push(violation.row, { check, violation });
    }
    focus = check.columns;
    if (check.kind === "variants" || check.id === "builtin:future") {
      focus = uniqueCells([...byRow.values()].flat());
    }
  } else if (sel.kind === "column") {
    for (const [row, issues] of result.byRow)
      for (const issue of issues) if (issue.violation.cells.includes(sel.column)) push(row, issue);
    focus = [sel.column];
  } else {
    if (!meta.personColumn) return null;
    for (const [row, issues] of result.byRow)
      if (personOf(ds, meta.personColumn, row) === sel.name) issues.forEach((i) => push(row, i));
    // The columns this person's issues touch most often.
    const freq = new Map<string, number>();
    for (const issues of byRow.values())
      for (const i of issues)
        for (const c of i.violation.cells) freq.set(c, (freq.get(c) ?? 0) + 1);
    focus = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([c]) => c);
  }

  const fixed = new Set([meta.idColumn, meta.personColumn, meta.rowNumberColumn].filter(Boolean));
  const focusColumns = focus.filter((c) => !fixed.has(c));

  let entries: TableEntry[];
  if (check?.kind === "groups" && check.groups) {
    // Show whole duplicate groups, including the first (kept) occurrence.
    entries = check.groups.flatMap((g): TableEntry[] => [
      { type: "group", size: g.length },
      ...g.map((row, i): TableEntry => ({
        type: "row",
        row,
        issues: byRow.get(row) ?? [],
        base: i === 0,
      })),
    ]);
  } else {
    entries = [...byRow.keys()]
      .sort((a, b) => a - b)
      .map((row) => ({ type: "row", row, issues: byRow.get(row)!, base: false }));
  }
  return { check, entries, focusColumns, flaggedRows: byRow.size };
}

function uniqueCells(issues: Issue[]): string[] {
  return [...new Set(issues.flatMap((i) => i.violation.cells))];
}

/** Messages per flagged cell for one table row, worst severity first. */
export function cellMessages(
  issues: Issue[],
): Map<string, { severity: "error" | "review"; messages: string[] }> {
  const out = new Map<string, { severity: "error" | "review"; messages: string[] }>();
  for (const { check, violation } of issues) {
    for (const c of violation.cells) {
      const cur = out.get(c) ?? { severity: "review" as const, messages: [] };
      if (check.severity === "error") cur.severity = "error";
      cur.messages.push(violation.message);
      out.set(c, cur);
    }
  }
  return out;
}
