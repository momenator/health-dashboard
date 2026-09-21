import type { CompareOp, Dataset, Dimension, RichText, Rule, RuleType, Violation } from "./types";
import { fmt, isEmpty, rangeText, sortKey, toNum } from "./values";

export const TYPE_DIMENSION: Record<RuleType, Dimension> = {
  range: "Validity",
  allowed: "Validity",
  compare: "Consistency",
  dateOrder: "Consistency",
  sum: "Consistency",
  requiredIf: "Conformity",
  required: "Completeness",
  unique: "Uniqueness",
};

export const TYPE_LABEL: Record<RuleType, string> = {
  range: "Range",
  allowed: "Allowed values",
  compare: "Compare two columns",
  dateOrder: "Date/time order",
  sum: "Sum",
  requiredIf: "Required if",
  required: "Required",
  unique: "Unique",
};

export const OP_WORD: Record<CompareOp, string> = {
  "<=": "at most",
  "<": "less than",
  ">=": "at least",
  ">": "more than",
  "=": "equal to",
};

const OPS: Record<CompareOp, (a: number, b: number) => boolean> = {
  "<=": (a, b) => a <= b,
  "<": (a, b) => a < b,
  ">=": (a, b) => a >= b,
  ">": (a, b) => a > b,
  "=": (a, b) => Math.abs(a - b) < 1e-9,
};

/** A sum rule's total is a fixed number when it parses as one, otherwise a column name. */
export function totalIsColumn(total: string): boolean {
  return !(total.trim() !== "" && Number.isFinite(Number(total)));
}

export function referencedColumns(rule: Rule): string[] {
  switch (rule.type) {
    case "range":
    case "allowed":
    case "unique":
      return [rule.params.column];
    case "required":
      return [...rule.params.columns];
    case "compare":
      return [rule.params.a, rule.params.b];
    case "dateOrder":
      return [rule.params.earlier, rule.params.later];
    case "sum":
      return [
        ...rule.params.parts,
        ...(totalIsColumn(rule.params.total) ? [rule.params.total] : []),
      ];
    case "requiredIf":
      return [rule.params.when, rule.params.then];
  }
}

/**
 * Which of the rule's columns the dataset lacks. A rule only runs when none
 * are missing; for `required` this keeps one table's required-field list from
 * running on another table that happens to share a few column names.
 */
export function missingColumns(rule: Rule, columns: string[]): string[] {
  return referencedColumns(rule).filter((c) => !columns.includes(c));
}

const code = (s: string) => ({ code: s });
const join = (items: string[], sep: string): RichText =>
  items.flatMap((s, i) => (i === 0 ? [code(s)] : [sep, code(s)]));

export function describeRule(rule: Rule): RichText {
  switch (rule.type) {
    case "range": {
      const p = rule.params;
      return [code(p.column), ` must be ${rangeText(p.min, p.max)}.`];
    }
    case "allowed":
      return [
        code(rule.params.column),
        " must be one of: ",
        ...join(rule.params.values, ", "),
        ".",
      ];
    case "compare": {
      const p = rule.params;
      return [code(p.a), ` must be ${OP_WORD[p.op]} `, code(p.b), "."];
    }
    case "dateOrder": {
      const p = rule.params;
      return [
        code(p.later),
        " must not be before ",
        code(p.earlier),
        ". Rows where either is empty are skipped.",
      ];
    }
    case "sum": {
      const p = rule.params;
      const total = totalIsColumn(p.total) ? [code(p.total)] : [p.total];
      return [
        ...join(p.parts, " + "),
        " must equal ",
        ...total,
        p.tolerance ? ` (±${fmt(p.tolerance)}).` : ".",
        " Rows with an empty part are skipped.",
      ];
    }
    case "requiredIf": {
      const p = rule.params;
      return [
        "When ",
        code(p.when),
        " is ",
        ...join(p.equals, " or "),
        ", ",
        code(p.then),
        ` must be ${p.expect}.`,
      ];
    }
    case "required":
      return [...join(rule.params.columns, ", "), " must be filled in every row."];
    case "unique":
      return ["Each value of ", code(rule.params.column), " may appear only once."];
  }
}

export interface RuleOutcome {
  columns: string[];
  violations: Violation[];
  groups?: number[][];
}

/** Evaluate one applicable rule against every row. */
export function evaluateRule(rule: Rule, ds: Dataset, label: (row: number) => string): RuleOutcome {
  const violations: Violation[] = [];
  const add = (row: number, cells: string[], message: string) =>
    violations.push({ row, cells, message });

  switch (rule.type) {
    case "unique": {
      const c = rule.params.column;
      const seen = new Map<string, number[]>();
      ds.rows.forEach((row, r) => {
        if (isEmpty(row[c])) return;
        const k = String(row[c]).trim();
        const list = seen.get(k);
        if (list) list.push(r);
        else seen.set(k, [r]);
      });
      const groups = [...seen.values()].filter((g) => g.length > 1);
      for (const g of groups)
        for (const r of g.slice(1)) add(r, [c], `Same ${c} as row ${label(g[0])}`);
      return { columns: [c], violations, groups };
    }

    case "range": {
      const { column: c, min, max } = rule.params;
      ds.rows.forEach((row, r) => {
        const x = toNum(row[c]);
        if (x === null) return;
        if (Number.isNaN(x)) add(r, [c], `“${row[c]}” is not a number`);
        else if ((min !== null && x < min) || (max !== null && x > max))
          add(r, [c], `${c} is ${fmt(x)}; expected ${rangeText(min, max)}`);
      });
      return { columns: [c], violations };
    }

    case "allowed": {
      const { column: c, values } = rule.params;
      const allowed = new Set(values);
      ds.rows.forEach((row, r) => {
        if (isEmpty(row[c])) return;
        if (!allowed.has(String(row[c]).trim()))
          add(r, [c], `“${row[c]}” is not an allowed value for ${c}`);
      });
      return { columns: [c], violations };
    }

    case "compare": {
      const { a, op, b } = rule.params;
      ds.rows.forEach((row, r) => {
        const x = toNum(row[a]);
        const y = toNum(row[b]);
        if (x === null || y === null || Number.isNaN(x) || Number.isNaN(y)) return;
        if (!OPS[op](x, y))
          add(r, [a, b], `${a} (${fmt(x)}) should be ${OP_WORD[op]} ${b} (${fmt(y)})`);
      });
      return { columns: [a, b], violations };
    }

    case "dateOrder": {
      const { earlier, later } = rule.params;
      ds.rows.forEach((row, r) => {
        const e = sortKey(row[earlier]);
        const l = sortKey(row[later]);
        if (e && l && l < e)
          add(r, [earlier, later], `${later} ${row[later]} is before ${earlier} ${row[earlier]}`);
      });
      return { columns: [earlier, later], violations };
    }

    case "sum": {
      const { parts, total, tolerance } = rule.params;
      const tc = totalIsColumn(total);
      const cells = [...parts, ...(tc ? [total] : [])];
      ds.rows.forEach((row, r) => {
        const xs = parts.map((c) => toNum(row[c]));
        if (xs.some((x) => x === null || Number.isNaN(x))) return;
        const t = tc ? toNum(row[total]) : Number(total);
        if (t === null || Number.isNaN(t)) return;
        const s = (xs as number[]).reduce((acc, x) => acc + x, 0);
        if (Math.abs(s - t) > tolerance + 1e-9)
          add(
            r,
            cells,
            `${parts.join(" + ")} = ${fmt(s)}, but ${tc ? `${total} is` : "expected"} ${fmt(t)}`,
          );
      });
      return { columns: cells, violations };
    }

    case "requiredIf": {
      const { when, equals, then, expect } = rule.params;
      const trigger = new Set(equals);
      ds.rows.forEach((row, r) => {
        const w = row[when];
        if (isEmpty(w) || !trigger.has(String(w).trim())) return;
        const empty = isEmpty(row[then]);
        if (expect === "filled" && empty)
          add(r, [when, then], `${when} is “${w}” but ${then} is empty`);
        if (expect === "empty" && !empty)
          add(r, [when, then], `${when} is “${w}”, so ${then} should be empty`);
      });
      return { columns: [when, then], violations };
    }

    case "required": {
      const cols = rule.params.columns;
      ds.rows.forEach((row, r) => {
        for (const c of cols) if (isEmpty(row[c])) add(r, [c], `${c} is empty`);
      });
      return { columns: cols, violations };
    }
  }
}
