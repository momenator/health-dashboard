import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { rowLabel } from "@/lib/dqi/detect";
import { INTENSITY_DIMENSIONS } from "@/lib/dqi/score";
import { isEmpty } from "@/lib/dqi/values";
import { cn } from "@/lib/utils";
import { cellMessages } from "@/lib/view";
import { useApp, useDisplayMeta } from "@/store/app";
import { Dot } from "./Tag";

export function RecordDrawer() {
  const dataset = useApp((s) => s.dataset);
  const result = useApp((s) => s.result);
  const openRow = useApp((s) => s.openRow);
  const meta = useDisplayMeta();
  const { setOpenRow, setTab, select } = useApp.getState();

  const open = openRow !== null && !!dataset && !!result && !!meta;
  const row = open ? dataset.rows[openRow] : null;
  const issues = open ? (result.byRow.get(openRow) ?? []) : [];
  const flagged = cellMessages(issues);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && setOpenRow(null)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {open && row && (
          <>
            <div className="border-b px-5 py-4 pr-12">
              <SheetTitle className="text-base">
                Row {rowLabel(dataset, meta, openRow)}
                {meta.idColumn && (
                  <>
                    {" · "}
                    <code className="font-mono text-sm font-medium">{row[meta.idColumn]}</code>
                  </>
                )}
              </SheetTitle>
              <SheetDescription>
                {meta.personColumn && (
                  <>
                    Entered by <b className="text-foreground">{row[meta.personColumn] || "—"}</b>{" "}
                    ·{" "}
                  </>
                )}
                {issues.length} issue{issues.length === 1 ? "" : "s"} in this record
              </SheetDescription>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-5 py-4">
              <section>
                <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Issues per dimension
                </h3>
                <div className="flex flex-wrap gap-2">
                  {INTENSITY_DIMENSIONS.map((d) => (
                    <div key={d} className="min-w-[96px] rounded-lg border px-3 py-1.5">
                      <div className="text-lg font-bold tabular-nums">
                        {issues.filter((i) => i.check.dimension === d && i.check.scored).length}
                      </div>
                      <div className="text-xs text-muted-foreground">{d}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[12.5px] text-muted-foreground">
                  One issue is usually a typo. Several in the same record point to a pattern worth
                  following up with the person who entered it.
                </p>
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Issues
                </h3>
                <div className="flex flex-col gap-1.5">
                  {issues.map(({ check, violation }, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setOpenRow(null);
                        setTab("rule");
                        select({ kind: "check", id: check.id });
                      }}
                      className="grid cursor-pointer grid-cols-[auto_1fr] items-baseline gap-x-2 rounded-lg bg-muted px-3 py-2 text-left hover:bg-accent"
                    >
                      <Dot tone={check.severity === "error" ? "err" : "rev"} />
                      <span className="font-semibold">{check.label}</span>
                      <span className="col-start-2 text-[12.5px] text-muted-foreground">
                        {violation.message}
                      </span>
                    </button>
                  ))}
                  {!issues.length && <p className="text-muted-foreground">No issues.</p>}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  All fields
                </h3>
                <dl className="grid grid-cols-[minmax(120px,38%)_1fr] overflow-hidden rounded-lg border text-[12.5px]">
                  {dataset.columns.map((c) => {
                    const f = flagged.get(c);
                    return (
                      <div key={c} className="contents">
                        <dt className="border-b bg-muted px-2.5 py-1.5 font-mono break-all text-muted-foreground">
                          {c}
                        </dt>
                        <dd
                          className={cn(
                            "border-b px-2.5 py-1.5 font-mono break-words",
                            f && (f.severity === "error" ? "bg-err-soft" : "bg-rev-soft"),
                          )}
                        >
                          {isEmpty(row[c]) ? (
                            <span className="font-sans text-muted-foreground italic">empty</span>
                          ) : (
                            row[c]
                          )}
                          {f?.messages.map((m, i) => (
                            <small key={i} className="mt-0.5 block font-sans text-muted-foreground">
                              {m}
                            </small>
                          ))}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
