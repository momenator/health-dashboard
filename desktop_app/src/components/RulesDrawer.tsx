import { ChevronRight, Plus, RotateCcw, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { missingColumns, TYPE_DIMENSION } from "@/lib/dqi/rules";
import { parseRuleSet } from "@/lib/dqi/schema";
import type { BuiltinSettings, Rule } from "@/lib/dqi/types";
import { editorMode } from "@/lib/editor";
import { saveFile } from "@/lib/platform";
import {
  describeRuleTranslated,
  ruleLabel,
  ruleTypeLabel,
  translate,
  type MessageKey,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { shippedRuleSet } from "@/rules";
import { useApp } from "@/store/app";
import { RichText } from "./RichText";
import { newRuleDraft, RuleForm } from "./RuleForm";
import { Tag } from "./Tag";

export function RulesDrawer() {
  const open = useApp((s) => s.rulesOpen);
  const closeRules = useApp((s) => s.closeRules);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeRules()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        {/* Mounted only while open, so its editing state starts fresh each time. */}
        {open && <RulesBody />}
      </SheetContent>
    </Sheet>
  );
}

function RulesBody() {
  const language = useApp((s) => s.language);
  const t = (key: MessageKey) => translate(language, key);
  const focusRuleId = useApp((s) => s.focusRuleId);
  const ruleSet = useApp((s) => s.ruleSet);
  const dataset = useApp((s) => s.dataset);
  const result = useApp((s) => s.result);
  const setRuleSet = useApp((s) => s.setRuleSet);
  const [editing, setEditing] = useState<string | null>(
    focusRuleId && editorMode && focusRuleId !== "builtin" ? focusRuleId : null,
  );
  const [newRule, setNewRule] = useState<Rule | null>(null);
  const body = useRef<HTMLDivElement>(null);

  // Scroll to the requested rule (or the built-in section).
  useEffect(() => {
    if (!focusRuleId) return;
    const t = setTimeout(() => {
      const el = body.current?.querySelector<HTMLElement>(`[data-rule="${focusRuleId}"]`);
      if (el) {
        el.closest("details")?.setAttribute("open", "");
        el.scrollIntoView({ block: "center" });
      }
    }, 50);
    return () => clearTimeout(t);
  }, [focusRuleId]);

  const columns = dataset?.columns ?? [];
  const applies = (r: Rule) => !!dataset && missingColumns(r, columns).length === 0;
  const applicable = ruleSet.rules.filter(applies);
  const waiting = ruleSet.rules.filter((r) => !applies(r));
  const changed = JSON.stringify(ruleSet) !== JSON.stringify(shippedRuleSet);

  const updateRules = (rules: Rule[]) => setRuleSet({ ...ruleSet, rules });
  const updateBuiltin = (patch: Partial<BuiltinSettings>) =>
    setRuleSet({ ...ruleSet, builtin: { ...ruleSet.builtin, ...patch } });

  const saveRule = (original: Rule | null, rule: Rule) => {
    updateRules(
      original
        ? ruleSet.rules.map((r) => (r.id === original.id ? rule : r))
        : [rule, ...ruleSet.rules],
    );
    setEditing(null);
    setNewRule(null);
    const check = useApp.getState().result?.checks.find((c) => c.rule?.id === rule.id);
    toast.success(`Saved “${rule.label}”`, {
      description: check
        ? `Flags ${check.rows.size.toLocaleString()} rows in this file.`
        : "It will run on files that have its columns.",
    });
  };

  const saveRulesFile = async () => {
    try {
      const validated = parseRuleSet(ruleSet);
      const saved = await saveFile(JSON.stringify(validated, null, 2) + "\n", {
        defaultName: "rules.json",
        filterName: "Rules",
        extensions: ["json"],
        mimeType: "application/json",
      });
      if (saved)
        toast.success("rules.json saved", {
          description:
            "Replace desktop_app/src/rules/rules.json with it, commit, and release a new version.",
        });
    } catch (e) {
      toast.error("The rules aren't valid", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const card = (rule: Rule) => {
    const check = result?.checks.find((c) => c.rule?.id === rule.id);
    const missing = dataset ? missingColumns(rule, columns) : [];
    const isEditing = editing === rule.id;
    return (
      <div
        key={rule.id}
        data-rule={rule.id}
        className={cn(
          "flex flex-col gap-1.5 rounded-lg border px-3 py-2.5",
          !rule.enabled && "opacity-65",
          focusRuleId === rule.id && "border-primary ring-2 ring-primary-soft",
        )}
      >
        <div className="flex items-start gap-3">
          {editorMode && (
            <Switch
              className="mt-0.5"
              checked={rule.enabled}
              aria-label={`Rule on or off: ${rule.label}`}
              onCheckedChange={(enabled) =>
                updateRules(ruleSet.rules.map((r) => (r.id === rule.id ? { ...r, enabled } : r)))
              }
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{ruleLabel(language, rule.label)}</div>
            <p className="text-[12.5px] text-muted-foreground">
              <RichText value={describeRuleTranslated(rule, language)} />
            </p>
          </div>
          {editorMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(isEditing ? null : rule.id)}
            >
              {isEditing ? t("close") : t("edit")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Tag>{ruleTypeLabel(language, rule.type)}</Tag>
          <Tag>{TYPE_DIMENSION[rule.type]}</Tag>
          {!rule.enabled ? (
            <Tag>{t("off")}</Tag>
          ) : check ? (
            check.rows.size ? (
              <Tag tone="err">
                {check.rows.size.toLocaleString()} {t("rowsFlagged")}
              </Tag>
            ) : (
              <Tag tone="ok">{t("passed")}</Tag>
            )
          ) : missing.length ? (
            <span>
              {t("needsColumns")}
              {missing.length > 1 ? "s" : ""}{" "}
              {missing.map((m) => (
                <code key={m} className="mr-1 font-mono">
                  {m}
                </code>
              ))}
            </span>
          ) : null}
          <code className="ml-auto font-mono text-[11px]">{rule.id}</code>
        </div>
        {isEditing && (
          <RuleForm
            rule={rule}
            isNew={false}
            dataset={dataset}
            existingIds={ruleSet.rules.filter((r) => r.id !== rule.id).map((r) => r.id)}
            onSave={(r) => saveRule(rule, r)}
            onCancel={() => setEditing(null)}
            onDelete={() => {
              updateRules(ruleSet.rules.filter((r) => r.id !== rule.id));
              setEditing(null);
            }}
          />
        )}
      </div>
    );
  };

  const b = ruleSet.builtin;
  const builtinRow = (
    key: keyof BuiltinSettings &
      ("identical" | "textInNumbers" | "future" | "outliers" | "spelling"),
    title: string,
    text: string,
    extra?: React.ReactNode,
  ) => (
    <div className="flex items-start gap-3">
      {editorMode ? (
        <Switch
          className="mt-0.5"
          checked={b[key]}
          aria-label={title}
          onCheckedChange={(v) => updateBuiltin({ [key]: v })}
        />
      ) : (
        <Tag tone={b[key] ? "ok" : "neutral"} className="mt-0.5">
          {b[key] ? t("on") : t("off")}
        </Tag>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <p className="text-[12.5px] text-muted-foreground">{text}</p>
        {extra}
      </div>
    </div>
  );

  return (
    <>
      <div className="border-b px-5 py-4 pr-12">
        <SheetTitle className="text-base">
          {t("rules")} · version {ruleSet.version}
        </SheetTitle>
        <SheetDescription>
          {editorMode ? t("editorDescription") : t("everyInstallation")}
        </SheetDescription>
        {editorMode && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Version
              <input
                className="h-8 w-44 rounded-md border bg-card px-2 font-mono text-[13px] text-foreground"
                value={ruleSet.version}
                onChange={(e) => setRuleSet({ ...ruleSet, version: e.target.value })}
              />
            </label>
            <Button size="sm" onClick={saveRulesFile}>
              <Save /> {t("saveRules")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setNewRule(
                  newRuleDraft(
                    ruleSet.rules.map((r) => r.id),
                    columns,
                  ),
                )
              }
            >
              <Plus /> {t("addRule")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!changed}
              onClick={() => {
                const before = ruleSet;
                setRuleSet(shippedRuleSet);
                toast(t("resetShipped"), {
                  action: { label: "Undo", onClick: () => setRuleSet(before) },
                });
              }}
            >
              <RotateCcw /> {t("resetShipped")}
            </Button>
            {changed && <Tag tone="info">{t("unsavedChanges")}</Tag>}
          </div>
        )}
      </div>

      <div ref={body} className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-5 py-4">
        {newRule && (
          <div className="rounded-lg border border-primary px-3 py-2.5">
            <div className="font-semibold">{t("newRule")}</div>
            <RuleForm
              rule={newRule}
              isNew
              dataset={dataset}
              existingIds={ruleSet.rules.map((r) => r.id)}
              onSave={(r) => saveRule(null, r)}
              onCancel={() => setNewRule(null)}
              onDelete={() => setNewRule(null)}
            />
          </div>
        )}

        <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {dataset ? `${t("applyTo")} ${dataset.name} · ${applicable.length}` : t("rules")}
        </h3>
        {applicable.length ? (
          applicable.map(card)
        ) : (
          <p className="text-muted-foreground">{t("noRuleMatches")}</p>
        )}

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
            {t("waitingOtherFiles")} · {waiting.length}
          </summary>
          <div className="mt-3 flex flex-col gap-3">{waiting.map(card)}</div>
        </details>

        <h3 className="mt-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {t("builtInChecks")}
        </h3>
        <div
          data-rule="builtin"
          className={cn(
            "flex flex-col gap-4 rounded-lg border px-3 py-3",
            focusRuleId === "builtin" && "border-primary ring-2 ring-primary-soft",
          )}
        >
          {builtinRow("identical", t("identicalRows"), t("identicalRowsDescription"))}
          {builtinRow("textInNumbers", t("textInNumbers"), t("textInNumbersDescription"))}
          {builtinRow("future", t("futureDates"), t("futureDatesDescription"))}
          {builtinRow(
            "outliers",
            t("unusualValues"),
            `${t("unusualValuesDescription")} ${b.k}×, ${b.minN} values.`,
            <>
              {editorMode && (
                <div className="mt-2 flex flex-wrap gap-3 text-[12.5px]">
                  <label className="flex items-center gap-1.5">
                    {t("spreadMultiplier")}
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      className="h-7 w-20 rounded-md border bg-card px-2"
                      value={b.k}
                      onChange={(e) =>
                        Number(e.target.value) > 0 && updateBuiltin({ k: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    {t("minimumValues")}
                    <input
                      type="number"
                      step="1"
                      min="5"
                      className="h-7 w-20 rounded-md border bg-card px-2"
                      value={b.minN}
                      onChange={(e) =>
                        Number(e.target.value) >= 5 &&
                        updateBuiltin({ minN: Math.round(Number(e.target.value)) })
                      }
                    />
                  </label>
                </div>
              )}
              {b.ignoredColumns.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  {t("notChecked")}:
                  {b.ignoredColumns.map((c) =>
                    editorMode ? (
                      <button
                        key={c}
                        type="button"
                        className="cursor-pointer rounded-md border px-1.5 font-mono hover:bg-muted"
                        title={t("checkAgain")}
                        onClick={() =>
                          updateBuiltin({
                            ignoredColumns: b.ignoredColumns.filter((x) => x !== c),
                          })
                        }
                      >
                        {c} ✕
                      </button>
                    ) : (
                      <code key={c} className="font-mono">
                        {c}
                      </code>
                    ),
                  )}
                </p>
              )}
              {result && result.outlierSkipped.length > 0 && (
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {t("skippedInFile")}:{" "}
                  {result.outlierSkipped.map((s) => `${s.column} (${s.reason})`).join(", ")}
                </p>
              )}
            </>,
          )}
          {builtinRow("spelling", t("spellingVariants"), t("spellingVariantsDescription"))}
        </div>
      </div>
    </>
  );
}
