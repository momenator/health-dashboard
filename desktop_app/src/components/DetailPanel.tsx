import { EyeOff, FileDown, ListChecks, SlidersHorizontal, ToggleLeft } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TYPE_LABEL } from "@/lib/dqi/rules";
import { fmt } from "@/lib/dqi/values";
import { editorMode } from "@/lib/editor";
import { exportPersonList } from "@/lib/exportActions";
import { cn } from "@/lib/utils";
import { buildDetailView } from "@/lib/view";
import { useApp, useDisplayMeta } from "@/store/app";
import { FlaggedRowsTable } from "./FlaggedRowsTable";
import { RichText } from "./RichText";
import { Tag } from "./Tag";

export function DetailPanel() {
  const dataset = useApp((s) => s.dataset)!;
  const result = useApp((s) => s.result)!;
  const ruleSet = useApp((s) => s.ruleSet);
  const selection = useApp((s) => s.selection);
  const variant = useApp((s) => s.variant);
  const showAll = useApp((s) => s.showAllColumns);
  const { setVariant, setShowAllColumns, openRules, setRuleSet } = useApp.getState();
  const meta = useDisplayMeta()!;

  const view = useMemo(
    () => (selection ? buildDetailView(dataset, result, meta, selection, variant) : null),
    [dataset, result, meta, selection, variant],
  );

  if (!selection || !view)
    return (
      <section className="flex items-center justify-center rounded-xl border bg-card p-10 text-center text-muted-foreground">
        <div>
          <div className="mb-1 text-base font-semibold text-foreground">Nothing to show</div>
          {result.checks.some((c) => c.rows.size)
            ? "Pick a rule, column or person on the left."
            : "Every check that applies to this file passed. Open Rules to see which rules ran."}
        </div>
      </section>
    );

  const { check } = view;
  const fixed = new Set([meta.idColumn, meta.personColumn, meta.rowNumberColumn]);
  const columns = showAll ? dataset.columns.filter((c) => !fixed.has(c)) : view.focusColumns;

  const turnOff = (ruleId: string) => {
    const rules = ruleSet.rules.map((r) => (r.id === ruleId ? { ...r, enabled: false } : r));
    setRuleSet({ ...ruleSet, rules });
    toast(`Turned off “${ruleSet.rules.find((r) => r.id === ruleId)?.label}”`, {
      description: "Turn it back on in Rules. Save rules.json to keep the change.",
    });
  };
  const ignoreColumn = (column: string) => {
    setRuleSet({
      ...ruleSet,
      builtin: {
        ...ruleSet.builtin,
        ignoredColumns: [...new Set([...ruleSet.builtin.ignoredColumns, column])],
      },
    });
    toast(`${column} is no longer checked for unusual values`, {
      description: "Save rules.json to keep the change.",
    });
  };

  let title: string;
  let tags: React.ReactNode = null;
  let description: React.ReactNode = null;
  let actions: React.ReactNode = null;

  if (check) {
    title = check.label;
    tags = (
      <>
        <Tag tone={check.severity === "error" ? "err" : "rev"}>
          {check.severity === "error" ? "Needs fixing" : "Worth a look"}
        </Tag>
        <Tag>
          {check.dimension}
          {!check.scored && " · not scored"}
        </Tag>
        <Tag>{check.rule ? `${TYPE_LABEL[check.rule.type]} rule` : "Built-in check"}</Tag>
      </>
    );
    description = <RichText value={check.description} />;
    if (check.rule) {
      const ruleId = check.rule.id;
      actions = (
        <>
          <Button variant="outline" size="sm" onClick={() => openRules(ruleId)}>
            <ListChecks /> {editorMode ? "Edit rule" : "View rule"}
          </Button>
          {editorMode && (
            <Button variant="ghost" size="sm" onClick={() => turnOff(ruleId)}>
              <ToggleLeft /> Turn off
            </Button>
          )}
        </>
      );
    } else if (editorMode) {
      actions = (
        <>
          <Button variant="outline" size="sm" onClick={() => openRules("builtin")}>
            <SlidersHorizontal />{" "}
            {check.ignoreColumn ? "Change sensitivity" : "Built-in check settings"}
          </Button>
          {check.ignoreColumn && (
            <Button variant="ghost" size="sm" onClick={() => ignoreColumn(check.ignoreColumn!)}>
              <EyeOff /> Stop checking this column
            </Button>
          )}
        </>
      );
    }
  } else if (selection.kind === "column") {
    const s = result.columnStats.find((x) => x.column === selection.column)!;
    title = selection.column;
    tags = <Tag>Column</Tag>;
    description = `${s.flagged.toLocaleString()} rows flagged in this column by any check · ${s.missing.toLocaleString()} rows (${fmt((s.missing / result.rowCount) * 100)}%) are empty.`;
  } else {
    title = selection.kind === "person" ? selection.name : "";
    tags = <Tag>Data entry by</Tag>;
    description =
      "Every flagged record entered by this person. Export the list to send it to them for correction.";
    const name = title;
    actions = (
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            if (await exportPersonList(dataset, result, meta, name))
              toast.success(`Saved the list for ${name}`);
          } catch (e) {
            toast.error("The Excel file couldn't be saved", {
              description: e instanceof Error ? e.message : String(e),
            });
          }
        }}
      >
        <FileDown /> Export this list
      </Button>
    );
  }

  const variantGroups = check?.kind === "variants" ? (check.variantGroups ?? []) : [];

  return (
    <section className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border bg-card md:min-h-0">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b px-4 py-3.5">
        <div className="min-w-0 flex-[1_1_320px]">
          <div className="mb-2 flex flex-wrap gap-1.5">{tags}</div>
          <h2 className="mb-1 text-lg font-semibold tracking-tight text-balance break-words">
            {title}
          </h2>
          <p className="max-w-[72ch] text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      {variantGroups.length > 0 && (
        <div className="flex max-h-56 flex-col gap-2 overflow-auto border-b px-4 py-3">
          {variantGroups.slice(0, 60).map((g) => (
            <div key={`${g.column}:${g.canonical}`} className="flex flex-wrap items-center gap-1.5">
              <code className="min-w-[170px] font-mono text-xs text-muted-foreground">
                {g.column}
              </code>
              <span
                className="inline-flex h-6 items-center gap-1.5 rounded-md bg-ok-soft px-2 text-[12.5px] text-ok"
                title="Most common spelling"
              >
                {g.canonical} <b className="tabular-nums">{g.canonicalCount}</b>
              </span>
              {g.variants.map((v) => {
                const active = variant?.column === g.column && variant.value === v.value;
                return (
                  <button
                    key={v.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setVariant(active ? null : { column: g.column, value: v.value })}
                    className={cn(
                      "inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-md border border-rev-line bg-rev-soft px-2 text-[12.5px]",
                      active && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                    )}
                  >
                    {v.value} <b className="tabular-nums">{v.count}</b>
                  </button>
                );
              })}
            </div>
          ))}
          {variantGroups.length > 60 && (
            <div className="text-xs text-muted-foreground">
              + {variantGroups.length - 60} more groups
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 text-[12.5px] text-muted-foreground">
        <span>
          <b className="text-foreground">
            {view.flaggedRows.toLocaleString()} row{view.flaggedRows === 1 ? "" : "s"} ·{" "}
            {fmt((view.flaggedRows / result.rowCount) * 100)}% of records
          </b>
          {variant && (
            <>
              {" "}
              · only “{variant.value}”{" "}
              <button
                type="button"
                className="cursor-pointer text-primary hover:underline"
                onClick={() => setVariant(null)}
              >
                show all variants
              </button>
            </>
          )}
        </span>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-foreground">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAllColumns(e.target.checked)}
          />{" "}
          Show all columns
        </label>
        <span className="ml-auto">
          Hover a highlighted cell to see why. Click a row to open the full record.
        </span>
      </div>

      {view.entries.length ? (
        <FlaggedRowsTable
          key={`${JSON.stringify(selection)}|${variant?.column}|${variant?.value}`}
          dataset={dataset}
          meta={meta}
          entries={view.entries}
          columns={columns}
          singleCheck={!!check}
        />
      ) : (
        <div className="p-10 text-center text-muted-foreground">
          <div className="mb-1 font-semibold text-foreground">Nothing flagged</div>
          This check passed for every row.
        </div>
      )}
    </section>
  );
}
