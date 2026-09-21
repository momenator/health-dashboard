import { useMemo } from "react";
import { create } from "zustand";
import { runDqi } from "@/lib/dqi/engine";
import type { ColumnMeta, Dataset, DqiResult, RuleSet } from "@/lib/dqi/types";
import { shippedRuleSet } from "@/rules";
import type { Language } from "@/lib/i18n";

export type Tab = "rule" | "column" | "person";

export type Selection =
  | { kind: "check"; id: string }
  | { kind: "column"; column: string }
  | { kind: "person"; name: string };

interface AppState {
  language: Language;
  dataset: Dataset | null;
  ruleSet: RuleSet;
  result: DqiResult | null;
  /** User overrides of the detected ID / person columns (display and grouping only). undefined = use detected. */
  idColumnOverride: string | null | undefined;
  personColumnOverride: string | null | undefined;
  tab: Tab;
  selection: Selection | null;
  variant: { column: string; value: string } | null;
  showAllColumns: boolean;
  openRow: number | null;
  rulesOpen: boolean;
  focusRuleId: string | null;

  openDataset: (ds: Dataset) => void;
  closeDataset: () => void;
  /** Editor mode only: replace the rules and re-check the open file. */
  setRuleSet: (rs: RuleSet) => void;
  setTab: (tab: Tab) => void;
  select: (sel: Selection | null) => void;
  setVariant: (v: { column: string; value: string } | null) => void;
  setShowAllColumns: (v: boolean) => void;
  setOpenRow: (row: number | null) => void;
  openRules: (focusRuleId?: string | null) => void;
  closeRules: () => void;
  setIdColumn: (c: string | null) => void;
  setPersonColumn: (c: string | null) => void;
  toggleLanguage: () => void;
}

/** The ID / person columns after applying the user's overrides. */
export function displayMeta(
  s: Pick<AppState, "result" | "idColumnOverride" | "personColumnOverride">,
): ColumnMeta | null {
  if (!s.result) return null;
  return {
    ...s.result.meta,
    idColumn: s.idColumnOverride === undefined ? s.result.meta.idColumn : s.idColumnOverride,
    personColumn:
      s.personColumnOverride === undefined ? s.result.meta.personColumn : s.personColumnOverride,
  };
}

/** The rule with the most rows that need fixing, else the biggest "worth a look", else nothing. */
export function defaultSelection(result: DqiResult): Selection | null {
  const bySize = [...result.checks]
    .filter((c) => c.rows.size)
    .sort((a, b) => b.rows.size - a.rows.size);
  const first = bySize.find((c) => c.severity === "error") ?? bySize[0];
  return first ? { kind: "check", id: first.id } : null;
}

function selectionStillValid(sel: Selection | null, result: DqiResult, ds: Dataset): boolean {
  if (!sel) return false;
  if (sel.kind === "check") return result.checks.some((c) => c.id === sel.id);
  if (sel.kind === "column") return ds.columns.includes(sel.column);
  return true;
}

export const useApp = create<AppState>((set, get) => ({
  language: (localStorage.getItem("dfm-language") as Language) === "fr" ? "fr" : "en",
  dataset: null,
  ruleSet: shippedRuleSet,
  result: null,
  idColumnOverride: undefined,
  personColumnOverride: undefined,
  tab: "rule",
  selection: null,
  variant: null,
  showAllColumns: false,
  openRow: null,
  rulesOpen: false,
  focusRuleId: null,

  openDataset: (ds) => {
    const result = runDqi(ds, get().ruleSet);
    set({
      dataset: ds,
      result,
      idColumnOverride: undefined,
      personColumnOverride: undefined,
      tab: "rule",
      selection: defaultSelection(result),
      variant: null,
      showAllColumns: false,
      openRow: null,
    });
  },
  closeDataset: () =>
    set({ dataset: null, result: null, selection: null, openRow: null, rulesOpen: false }),

  setRuleSet: (ruleSet) => {
    const ds = get().dataset;
    if (!ds) return set({ ruleSet });
    const result = runDqi(ds, ruleSet);
    const sel = get().selection;
    set({
      ruleSet,
      result,
      selection: selectionStillValid(sel, result, ds) ? sel : defaultSelection(result),
      variant: null,
    });
  },

  setTab: (tab) => set({ tab, variant: null }),
  select: (selection) => set({ selection, variant: null }),
  setVariant: (variant) => set({ variant }),
  setShowAllColumns: (showAllColumns) => set({ showAllColumns }),
  setOpenRow: (openRow) => set({ openRow }),
  openRules: (focusRuleId = null) => set({ rulesOpen: true, focusRuleId, openRow: null }),
  closeRules: () => set({ rulesOpen: false, focusRuleId: null }),
  setIdColumn: (c) => set({ idColumnOverride: c }),
  setPersonColumn: (c) => set({ personColumnOverride: c }),
  toggleLanguage: () =>
    set((state) => {
      const language: Language = state.language === "en" ? "fr" : "en";
      localStorage.setItem("dfm-language", language);
      return { language };
    }),
}));

/** displayMeta for components; selects primitives so the store subscription stays stable. */
export function useDisplayMeta(): ColumnMeta | null {
  const result = useApp((s) => s.result);
  const idColumnOverride = useApp((s) => s.idColumnOverride);
  const personColumnOverride = useApp((s) => s.personColumnOverride);
  return useMemo(
    () => displayMeta({ result, idColumnOverride, personColumnOverride }),
    [result, idColumnOverride, personColumnOverride],
  );
}
