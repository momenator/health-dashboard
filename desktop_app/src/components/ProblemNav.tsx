import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { summarizePeople } from "@/lib/dqi/people";
import type { Check } from "@/lib/dqi/types";
import { fmt } from "@/lib/dqi/values";
import { cn } from "@/lib/utils";
import {
  defaultSelection,
  displayMeta,
  useApp,
  useDisplayMeta,
  type Selection,
  type Tab,
} from "@/store/app";
import { Summary } from "./Summary";
import { Dot, Tag } from "./Tag";

const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

export function ProblemNav() {
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);
  const select = useApp((s) => s.select);

  const changeTab = (t: string) => {
    const s = useApp.getState();
    setTab(t as Tab);
    const result = s.result!;
    const meta = displayMeta(s)!;
    if (t === "rule") select(defaultSelection(result));
    else if (t === "column") {
      const top = [...result.columnStats].sort((a, b) => b.flagged - a.flagged)[0];
      select(top?.flagged ? { kind: "column", column: top.column } : null);
    } else {
      const top = meta.personColumn
        ? summarizePeople(s.dataset!, result, meta.personColumn).find((p) => p.flagged)
        : undefined;
      select(top ? { kind: "person", name: top.name } : null);
    }
  };

  return (
    <aside
      aria-label="Problems"
      className="flex min-h-[320px] flex-col overflow-hidden rounded-xl border bg-card md:min-h-0"
    >
      <Summary />
      <Tabs value={tab} onValueChange={changeTab} className="border-b p-1.5">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rule">By rule</TabsTrigger>
          <TabsTrigger value="column">By column</TabsTrigger>
          <TabsTrigger value="person">By person</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        {tab === "rule" && <RuleList />}
        {tab === "column" && <ColumnList />}
        {tab === "person" && <PersonList />}
      </div>
    </aside>
  );
}

function isCurrent(sel: Selection | null, kind: Selection["kind"], key: string) {
  if (!sel || sel.kind !== kind) return false;
  return (
    (sel.kind === "check" && sel.id === key) ||
    (sel.kind === "column" && sel.column === key) ||
    (sel.kind === "person" && sel.name === key)
  );
}

function Item({
  current,
  onClick,
  title,
  count,
  children,
  mono,
}: {
  current: boolean;
  onClick: () => void;
  title: string;
  count?: number;
  children?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current}
      className={cn(
        "grid w-full cursor-pointer grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 rounded-lg px-2.5 py-2 text-left",
        current ? "bg-primary-soft" : "hover:bg-muted",
      )}
    >
      <span className={cn("font-medium break-words", mono && "font-mono text-[12.5px]")}>
        {title}
      </span>
      <span className="font-semibold tabular-nums">{count ? count.toLocaleString() : ""}</span>
      {children}
    </button>
  );
}

function SectionTitle({
  dot,
  children,
}: {
  dot?: "err" | "rev" | "ok" | "na";
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {dot && <Dot tone={dot} />}
      {children}
    </div>
  );
}

function Collapsible({
  dot,
  title,
  children,
}: {
  dot: "ok" | "na";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
        <Dot tone={dot} />
        {title}
      </summary>
      {children}
    </details>
  );
}

function RuleList() {
  const result = useApp((s) => s.result)!;
  const selection = useApp((s) => s.selection);
  const select = useApp((s) => s.select);

  const bySize = (a: Check, b: Check) => b.rows.size - a.rows.size;
  const errors = result.checks.filter((c) => c.severity === "error" && c.rows.size).sort(bySize);
  const reviews = result.checks.filter((c) => c.severity === "review" && c.rows.size).sort(bySize);
  const passed = result.checks.filter((c) => !c.rows.size);

  const item = (c: Check) => (
    <Item
      key={c.id}
      current={isCurrent(selection, "check", c.id)}
      onClick={() => select({ kind: "check", id: c.id })}
      title={c.label}
      count={c.rows.size}
    >
      <span className="col-span-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {c.dimension}
        {!c.scored && " · not scored"}
        {c.source === "builtin" && " · built-in"}
      </span>
    </Item>
  );

  return (
    <>
      <SectionTitle dot="err">Needs fixing · {errors.length}</SectionTitle>
      {errors.length ? (
        errors.map(item)
      ) : (
        <p className="px-2.5 py-1 text-sm text-muted-foreground">No rule violations.</p>
      )}
      <SectionTitle dot="rev">Worth a look · {reviews.length}</SectionTitle>
      {reviews.length ? (
        reviews.map(item)
      ) : (
        <p className="px-2.5 py-1 text-sm text-muted-foreground">Nothing unusual found.</p>
      )}
      <Collapsible dot="ok" title={`Passed · ${passed.length}`}>
        {passed.map(item)}
      </Collapsible>
      <Collapsible dot="na" title={`Doesn't apply to this file · ${result.notApplicable.length}`}>
        {result.notApplicable.map(({ rule, missing }) => (
          <div key={rule.id} className="px-2.5 py-1.5 text-[12.5px] text-muted-foreground">
            <div className="font-medium text-foreground">{rule.label}</div>
            No column{" "}
            {missing.map((m, i) => (
              <span key={m}>
                {i > 0 && ", "}
                <code className="font-mono">{m}</code>
              </span>
            ))}
          </div>
        ))}
      </Collapsible>
    </>
  );
}

function ColumnList() {
  const result = useApp((s) => s.result)!;
  const selection = useApp((s) => s.selection);
  const select = useApp((s) => s.select);
  const stats = useMemo(
    () => [...result.columnStats].sort((a, b) => b.flagged - a.flagged || b.missing - a.missing),
    [result],
  );
  const max = Math.max(1, ...stats.map((s) => s.flagged));
  return (
    <>
      <SectionTitle>Columns with the most flagged rows</SectionTitle>
      {stats.map((s) => (
        <Item
          key={s.column}
          mono
          current={isCurrent(selection, "column", s.column)}
          onClick={() => select({ kind: "column", column: s.column })}
          title={s.column}
          count={s.flagged}
        >
          <span className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full", s.errors ? "bg-err-line" : "bg-rev-line")}
              style={{ width: `${(s.flagged / max) * 100}%` }}
            />
          </span>
          <span className="col-span-2 text-xs text-muted-foreground">
            {s.flagged ? `${fmt(pct(s.flagged, result.rowCount))}% of rows flagged` : "No flags"} ·{" "}
            {fmt(pct(s.missing, result.rowCount))}% empty
          </span>
        </Item>
      ))}
    </>
  );
}

function PersonList() {
  const dataset = useApp((s) => s.dataset)!;
  const result = useApp((s) => s.result)!;
  const personColumn = useDisplayMeta()!.personColumn;
  const selection = useApp((s) => s.selection);
  const select = useApp((s) => s.select);
  const people = useMemo(
    () => (personColumn ? summarizePeople(dataset, result, personColumn) : []),
    [dataset, result, personColumn],
  );

  if (!personColumn)
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        <div className="mb-1 font-semibold text-foreground">No data-entry column found</div>
        Choose the column that records who entered each row under <b>Details</b> → <b>Entered by</b>{" "}
        at the top of this panel.
      </div>
    );

  return (
    <>
      <SectionTitle>
        By <code className="font-mono normal-case tracking-normal">{personColumn}</code>
      </SectionTitle>
      {people.map((p) => (
        <Item
          key={p.name}
          current={isCurrent(selection, "person", p.name)}
          onClick={() => select({ kind: "person", name: p.name })}
          title={p.name}
          count={p.flagged}
        >
          <span className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full", p.needsFixing ? "bg-err-line" : "bg-rev-line")}
              style={{ width: `${pct(p.flagged, p.records)}%` }}
            />
          </span>
          <span className="col-span-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {p.flagged} of {p.records} records flagged
            {p.needsFixing > 0 && <Tag tone="err">{p.needsFixing} need fixing</Tag>}
            {p.topIssue && <span>· mostly “{p.topIssue[0]}”</span>}
          </span>
        </Item>
      ))}
    </>
  );
}
