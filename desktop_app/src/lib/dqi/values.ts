import type { RichText } from "./types";

/** Empty cells: missing, whitespace, or CommCare's "---" placeholder. */
export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === "" || s === "---";
}

/** null for empty cells, NaN for non-numeric text, otherwise the number. */
export function toNum(v: unknown): number | null {
  if (isEmpty(v)) return null;
  const x = Number(String(v).trim());
  return Number.isFinite(x) ? x : NaN;
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const TIME_RE = /^(\d{1,2}):(\d{2})/;

/** A string that sorts chronologically for ISO dates or HH:MM times, else null. */
export function sortKey(v: unknown): string | null {
  if (isEmpty(v)) return null;
  const s = String(v).trim();
  if (DATE_RE.test(s)) return s;
  const m = s.match(TIME_RE);
  if (m) return m[1].padStart(2, "0") + ":" + m[2] + s.slice(m[0].length);
  return null;
}

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
export function fmt(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return nf.format(Math.round(x * 100) / 100);
}

export function rangeText(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${fmt(min)}–${fmt(max)}`;
  if (min !== null) return `at least ${fmt(min)}`;
  if (max !== null) return `at most ${fmt(max)}`;
  return "any value";
}

export function plainText(t: RichText): string {
  return t.map((p) => (typeof p === "string" ? p : p.code)).join("");
}

/** Linear-interpolation quantile (same as numpy's default) on sorted input. */
export function quantile(sorted: number[], p: number): number {
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  return lo + 1 < sorted.length
    ? sorted[lo] + (sorted[lo + 1] - sorted[lo]) * (pos - lo)
    : sorted[lo];
}

/** Lowercase, strip accents and anything that isn't a letter or digit. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Levenshtein distance, giving up (returning max + 1) once it exceeds `max`. */
export function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
