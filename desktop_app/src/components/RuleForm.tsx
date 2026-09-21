import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OP_WORD, TYPE_DIMENSION, TYPE_LABEL } from "@/lib/dqi/rules";
import { compareOps, ruleSchema } from "@/lib/dqi/schema";
import type { Dataset, Rule, RuleType } from "@/lib/dqi/types";
import { isEmpty } from "@/lib/dqi/values";
import { translate, type MessageKey } from "@/lib/i18n";
import { useApp } from "@/store/app";

type Draft = {
  id: string;
  label: string;
  enabled: boolean;
  type: RuleType;
  params: Record<string, unknown>;
};

const BLANK: Record<RuleType, (cols: string[]) => Record<string, unknown>> = {
  range: (c) => ({ column: c[0] ?? "", min: 0, max: null }),
  allowed: (c) => ({ column: c[0] ?? "", values: [] }),
  compare: (c) => ({ a: c[0] ?? "", op: "<=", b: c[1] ?? "" }),
  dateOrder: (c) => ({ earlier: c[0] ?? "", later: c[1] ?? "" }),
  sum: () => ({ parts: [], total: "", tolerance: 0 }),
  requiredIf: (c) => ({ when: c[0] ?? "", equals: [], then: c[1] ?? "", expect: "filled" }),
  required: () => ({ columns: [] }),
  unique: (c) => ({ column: c[0] ?? "" }),
};

export function newRuleDraft(existingIds: string[], columns: string[]): Rule {
  let n = 1;
  while (existingIds.includes(`new-rule-${n}`)) n++;
  return {
    id: `new-rule-${n}`,
    label: "New rule",
    enabled: true,
    type: "range",
    params: BLANK.range(columns),
  } as Rule;
}

const inputCls = "h-8 w-full rounded-md border bg-card px-2 text-[13px] text-foreground";
const labelCls = "flex flex-col gap-1 text-xs font-medium text-muted-foreground";

interface Props {
  rule: Rule;
  isNew: boolean;
  dataset: Dataset | null;
  existingIds: string[];
  onSave: (rule: Rule) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function RuleForm({ rule, isNew, dataset, existingIds, onSave, onCancel, onDelete }: Props) {
  const language = useApp((s) => s.language);
  const t = (key: MessageKey) => translate(language, key);
  const [draft, setDraft] = useState<Draft>(() => structuredClone(rule) as Draft);
  const [errors, setErrors] = useState<string[]>([]);
  const cols = dataset?.columns ?? [];
  const p = draft.params;
  const set = (patch: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, params: { ...d.params, ...patch } }));

  const columnSelect = (key: string, label: string) => {
    const value = String(p[key] ?? "");
    const options = [...new Set([...cols, ...(value ? [value] : [])])];
    return (
      <label className={labelCls}>
        {label}
        <select
          className={`${inputCls} font-mono`}
          value={value}
          onChange={(e) => set({ [key]: e.target.value })}
        >
          <option value="">{t("chooseColumn")}</option>
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
              {cols.includes(c) ? "" : " (not in this file)"}
            </option>
          ))}
        </select>
      </label>
    );
  };

  const columnList = (key: string, label: string) => {
    const value = (p[key] as string[]) ?? [];
    return (
      <div className={`${labelCls} col-span-full`}>
        {label}
        <div className="flex flex-wrap items-center gap-1.5">
          {value.map((c) => (
            <span
              key={c}
              className="inline-flex h-7 items-center gap-1 rounded-md border bg-card pr-1 pl-2 font-mono text-[12.5px] text-foreground"
            >
              {c}
              <button
                type="button"
                aria-label={`Remove ${c}`}
                className="cursor-pointer rounded p-0.5 hover:bg-muted"
                onClick={() => set({ [key]: value.filter((x) => x !== c) })}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <select
            className={`${inputCls} w-auto font-mono`}
            value=""
            onChange={(e) => e.target.value && set({ [key]: [...value, e.target.value] })}
          >
            <option value="">{t("addColumn")}</option>
            {cols
              .filter((c) => !value.includes(c))
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </div>
      </div>
    );
  };

  const lines = (key: string, label: string, fillFrom?: string) => (
    <label className={`${labelCls} col-span-full`}>
      {label}
      <textarea
        className="min-h-[88px] w-full rounded-md border bg-card px-2 py-1.5 font-mono text-[12.5px] text-foreground"
        value={((p[key] as string[]) ?? []).join("\n")}
        onChange={(e) => set({ [key]: e.target.value.split("\n") })}
      />
      {fillFrom && dataset && (
        <span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const col = String(p[fillFrom] ?? "");
              if (!cols.includes(col)) return;
              const values = [
                ...new Set(
                  dataset.rows.map((r) => String(r[col] ?? "").trim()).filter((v) => !isEmpty(v)),
                ),
              ].sort();
              set({ [key]: values.slice(0, 300) });
            }}
          >
            {t("fillFromFile")}
          </Button>
        </span>
      )}
    </label>
  );

  const numberInput = (key: string, label: string, placeholder = "") => (
    <label className={labelCls}>
      {label}
      <input
        type="number"
        step="any"
        className={inputCls}
        placeholder={placeholder}
        value={p[key] === null || p[key] === undefined ? "" : String(p[key])}
        onChange={(e) => set({ [key]: e.target.value === "" ? null : Number(e.target.value) })}
      />
    </label>
  );

  const fields: Record<RuleType, () => React.ReactNode> = {
    range: () => (
      <>
        {columnSelect("column", t("column"))}
        {numberInput("min", t("minimum"), "none")}
        {numberInput("max", t("maximum"), "none")}
      </>
    ),
    allowed: () => (
      <>
        {columnSelect("column", t("column"))}
        {lines("values", t("allowedValues"), "column")}
      </>
    ),
    compare: () => (
      <>
        {columnSelect("a", t("columnA"))}
        <label className={labelCls}>
          {t("mustBe")}
          <select
            className={inputCls}
            value={String(p.op)}
            onChange={(e) => set({ op: e.target.value })}
          >
            {compareOps.map((o) => (
              <option key={o} value={o}>
                {OP_WORD[o]}
              </option>
            ))}
          </select>
        </label>
        {columnSelect("b", t("columnB"))}
      </>
    ),
    dateOrder: () => (
      <>
        {columnSelect("earlier", t("earlierColumn"))}
        {columnSelect("later", t("laterColumn"))}
      </>
    ),
    sum: () => (
      <>
        {columnList("parts", t("columnsToAdd"))}
        <label className={labelCls}>
          {t("mustEqual")}
          <input
            className={`${inputCls} font-mono`}
            list="rule-form-columns"
            value={String(p.total ?? "")}
            onChange={(e) => set({ total: e.target.value })}
          />
          <datalist id="rule-form-columns">
            {cols.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        {numberInput("tolerance", t("allowedDifference"))}
      </>
    ),
    requiredIf: () => (
      <>
        {columnSelect("when", t("whenColumn"))}
        {columnSelect("then", t("thenColumn"))}
        <label className={labelCls}>
          {t("mustBe")}
          <select
            className={inputCls}
            value={String(p.expect)}
            onChange={(e) => set({ expect: e.target.value })}
          >
            <option value="filled">{t("filled")}</option>
            <option value="empty">{t("empty")}</option>
          </select>
        </label>
        {lines("equals", t("valuesOnePerLine"), "when")}
      </>
    ),
    required: () => columnList("columns", t("requiredColumns")),
    unique: () => columnSelect("column", t("column")),
  };

  const save = () => {
    const cleaned = structuredClone(draft);
    for (const k of ["values", "equals"])
      if (Array.isArray(cleaned.params[k]))
        cleaned.params[k] = (cleaned.params[k] as string[]).map((s) => s.trim()).filter(Boolean);
    if (cleaned.type === "sum" && cleaned.params.tolerance === null) cleaned.params.tolerance = 0;
    cleaned.label = cleaned.label.trim();
    const problems: string[] = [];
    if (existingIds.includes(cleaned.id))
      problems.push(`Another rule already uses the id “${cleaned.id}”.`);
    const parsed = ruleSchema.safeParse(cleaned);
    if (!parsed.success)
      problems.push(
        ...parsed.error.issues.map((i) => `${i.path.join(".") || "rule"}: ${i.message}`),
      );
    setErrors(problems);
    if (!problems.length && parsed.success) onSave(parsed.data);
  };

  return (
    <form
      className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 rounded-lg bg-muted p-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className={`${labelCls} col-span-full`}>
        {t("name")}
        <input
          className={inputCls}
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        />
      </label>
      {isNew && (
        <>
          <label className={labelCls}>
            {t("ruleType")}
            <select
              className={inputCls}
              value={draft.type}
              onChange={(e) => {
                const type = e.target.value as RuleType;
                setDraft((d) => ({ ...d, type, params: BLANK[type](cols) }));
              }}
            >
              {(Object.keys(TYPE_LABEL) as RuleType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]} ({TYPE_DIMENSION[t]})
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            {t("ruleId")}
            <input
              className={`${inputCls} font-mono`}
              value={draft.id}
              onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value.trim() }))}
            />
          </label>
        </>
      )}
      {fields[draft.type]()}
      {errors.length > 0 && (
        <ul className="col-span-full list-disc rounded-md bg-err-soft py-2 pr-3 pl-7 text-[12.5px] text-err">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="col-span-full flex flex-wrap gap-2">
        <Button type="submit" size="sm">
          {t("saveRecheck")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto text-err"
          onClick={onDelete}
        >
          {t("deleteRule")}
        </Button>
      </div>
    </form>
  );
}
