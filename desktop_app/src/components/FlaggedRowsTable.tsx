import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import { rowLabel } from "@/lib/dqi/detect";
import type { ColumnMeta, Dataset } from "@/lib/dqi/types";
import { isEmpty } from "@/lib/dqi/values";
import { translate, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { cellMessages, type TableEntry } from "@/lib/view";
import { useApp } from "@/store/app";
import { Dot } from "./Tag";

interface Props {
  dataset: Dataset;
  meta: ColumnMeta;
  entries: TableEntry[];
  columns: string[];
  /** Hide the check name in "Why" when the whole table is one check. */
  singleCheck: boolean;
  /** Clean datasets show their rows without a findings column. */
  showWhy?: boolean;
}

interface Tip {
  x: number;
  y: number;
  below: boolean;
  messages: string[];
}

export function FlaggedRowsTable({
  dataset,
  meta,
  entries,
  columns,
  singleCheck,
  showWhy = true,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const setOpenRow = useApp((s) => s.setOpenRow);
  const language = useApp((s) => s.language);
  const t = (key: MessageKey) => translate(language, key);
  const [tip, setTip] = useState<Tip | null>(null);

  const fixed = [meta.idColumn, meta.personColumn].filter(
    (c): c is string => !!c && dataset.columns.includes(c),
  );
  const dataCols = [...fixed, ...columns];
  const template = `72px ${dataCols.map(() => "minmax(110px, 180px)").join(" ")}${showWhy ? " minmax(300px, 1fr)" : ""}`;

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 36,
    overscan: 12,
  });

  const showTip = (e: React.MouseEvent) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (!cell) return setTip(null);
    const r = cell.getBoundingClientRect();
    const below = r.bottom + 90 < window.innerHeight;
    setTip({
      x: Math.min(r.left, window.innerWidth - 360),
      y: below ? r.bottom + 6 : r.top - 6,
      below,
      messages: JSON.parse(cell.dataset.tip!),
    });
  };

  return (
    <>
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-auto"
        onMouseOver={showTip}
        onMouseLeave={() => setTip(null)}
        onScroll={() => tip && setTip(null)}
      >
        <div className="min-w-max" role="table" aria-rowcount={entries.length}>
          <div
            role="row"
            className="sticky top-0 z-20 grid border-b bg-muted text-xs font-semibold text-muted-foreground"
            style={{ gridTemplateColumns: template }}
          >
            <div role="columnheader" className="sticky left-0 z-10 bg-muted px-2.5 py-2 text-right">
              {t("rowLabel")}
            </div>
            {dataCols.map((c) => (
              <div
                key={c}
                role="columnheader"
                className="truncate px-2.5 py-2 font-mono font-medium"
                title={c}
              >
                {c}
              </div>
            ))}
            {showWhy && (
              <div role="columnheader" className="px-2.5 py-2">
                {t("whyFlagged")}
              </div>
            )}
          </div>

          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((v) => {
              const entry = entries[v.index];
              const style: React.CSSProperties = {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${v.start}px)`,
              };
              if (entry.type === "group")
                return (
                  <div
                    key={v.key}
                    ref={virtualizer.measureElement}
                    data-index={v.index}
                    style={style}
                    className="border-b bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    Group of {entry.size} matching rows
                  </div>
                );
              const row = dataset.rows[entry.row];
              const flagged = cellMessages(entry.issues);
              return (
                <div
                  key={v.key}
                  ref={virtualizer.measureElement}
                  data-index={v.index}
                  role="row"
                  tabIndex={0}
                  onClick={() => setOpenRow(entry.row)}
                  onKeyDown={(e) => e.key === "Enter" && setOpenRow(entry.row)}
                  style={{ ...style, gridTemplateColumns: template }}
                  className={cn(
                    "group grid cursor-pointer border-b text-[13px] hover:bg-muted/60",
                    entry.base && "text-muted-foreground",
                  )}
                >
                  <div
                    role="cell"
                    className="sticky left-0 z-10 bg-card px-2.5 py-2 text-right tabular-nums group-hover:bg-muted"
                  >
                    {rowLabel(dataset, meta, entry.row)}
                  </div>
                  {dataCols.map((c) => {
                    const v = row[c];
                    const f = flagged.get(c);
                    return (
                      <div
                        key={c}
                        role="cell"
                        data-tip={f ? JSON.stringify(f.messages) : undefined}
                        title={f ? undefined : v}
                        className={cn(
                          "truncate px-2.5 py-2 font-mono text-[12.5px]",
                          isEmpty(v) && "cell-empty",
                          f && (f.severity === "error" ? "cell-err" : "cell-rev"),
                        )}
                      >
                        {isEmpty(v) ? "" : v}
                      </div>
                    );
                  })}
                  {showWhy && (
                    <div role="cell" className="space-y-0.5 px-2.5 py-2 text-[12.5px]">
                      {entry.base ? (
                        <span>{t("firstOccurrence")}</span>
                      ) : (
                        entry.issues.map((i, k) => (
                          <div key={k} className="flex items-baseline gap-1.5">
                            <Dot tone={i.check.severity === "error" ? "err" : "rev"} />
                            <span>
                              {!singleCheck && <b className="font-semibold">{i.check.label}: </b>}
                              {i.violation.message}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 max-w-[340px] space-y-1 rounded-lg bg-foreground px-2.5 py-2 text-[12.5px] text-background shadow-lg"
          style={{
            left: Math.max(8, tip.x),
            top: tip.y,
            transform: tip.below ? undefined : "translateY(-100%)",
          }}
        >
          {tip.messages.map((m, i) => (
            <div key={i}>{m}</div>
          ))}
        </div>
      )}
    </>
  );
}
