import type { Check, Dimension, DimensionScore, Grade } from "./types";

export const DIMENSIONS: Array<{ dimension: Dimension; weight: number; blurb: string }> = [
  { dimension: "Uniqueness", weight: 25, blurb: "Records that are not duplicates" },
  {
    dimension: "Consistency",
    weight: 25,
    blurb: "Records whose fields don't contradict each other",
  },
  { dimension: "Validity", weight: 25, blurb: "Records with values in allowed ranges and codes" },
  { dimension: "Plausibility", weight: 25, blurb: "Records without statistical outliers" },
  { dimension: "Completeness", weight: 0, blurb: "Records with all key fields filled" },
  { dimension: "Conformity", weight: 0, blurb: "Records that follow the form's routing" },
];

/** Spec §4.1: intensity is reported for these dimensions only. */
export const INTENSITY_DIMENSIONS: Dimension[] = ["Consistency", "Validity", "Plausibility"];

const GRADES: Grade[] = [
  { label: "Excellent", min: 90 },
  { label: "Good", min: 80 },
  { label: "Acceptable", min: 70 },
  { label: "Poor", min: 60 },
  { label: "Critical", min: 0 },
];

export function gradeFor(score: number): Grade {
  return GRADES.find((g) => score >= g.min)!;
}

/**
 * Spec §4: a dimension's score is the share of rows with no violation in any
 * of its scored checks. A row counts once per dimension. Dimensions with no
 * applicable check are "not assessed" and left out of the DQI.
 */
export function scoreDimensions(
  checks: Check[],
  rowCount: number,
): { dimensions: Record<Dimension, DimensionScore>; dqi: number | null; grade: Grade | null } {
  const dimensions = {} as Record<Dimension, DimensionScore>;
  for (const { dimension, weight } of DIMENSIONS) {
    const inDim = checks.filter((c) => c.dimension === dimension && c.scored);
    const perRow = new Map<number, number>();
    for (const c of inDim)
      for (const v of c.violations) perRow.set(v.row, (perRow.get(v.row) ?? 0) + 1);
    const assessed = inDim.length > 0 && rowCount > 0;
    const intensity =
      INTENSITY_DIMENSIONS.includes(dimension) && perRow.size
        ? [...perRow.values()].reduce((a, b) => a + b, 0) / perRow.size
        : null;
    dimensions[dimension] = {
      dimension,
      weight,
      assessed,
      checks: inDim.length,
      flagged: perRow.size,
      score: assessed ? (1 - perRow.size / rowCount) * 100 : null,
      meanIntensity: intensity,
    };
  }
  const scored = DIMENSIONS.filter((d) => d.weight > 0 && dimensions[d.dimension].assessed);
  const weightSum = scored.reduce((a, d) => a + d.weight, 0);
  const dqi = weightSum
    ? scored.reduce((a, d) => a + dimensions[d.dimension].score! * d.weight, 0) / weightSum
    : null;
  return { dimensions, dqi, grade: dqi === null ? null : gradeFor(dqi) };
}
