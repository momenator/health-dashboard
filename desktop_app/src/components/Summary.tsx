import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DIMENSIONS, INTENSITY_DIMENSIONS } from "@/lib/dqi/score";
import { fmt } from "@/lib/dqi/values";
import { translate, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useApp, useDisplayMeta } from "@/store/app";

const GRADE_TONE: Record<string, string> = {
  Excellent: "bg-ok-soft text-ok",
  Good: "bg-primary-soft text-primary",
  Acceptable: "bg-rev-soft text-rev",
  Poor: "bg-err-soft text-err",
  Critical: "bg-err-soft text-err",
};

const NONE = "__none__";

/** Compact DQI headline for the top of the left panel; the breakdown lives in a popover. */
export function Summary() {
  const dataset = useApp((s) => s.dataset)!;
  const result = useApp((s) => s.result)!;
  const language = useApp((s) => s.language);
  const t = (key: MessageKey) => translate(language, key);

  return (
    <div className="flex flex-col gap-1 border-b px-3.5 py-3">
      <div className="truncate text-[13px] font-semibold" title={dataset.name}>
        {dataset.name}
      </div>
      <div className="flex items-center gap-2">
        <span
          className="text-[28px] leading-none font-bold tracking-tight tabular-nums"
          title="Data Quality Index"
        >
          {result.dqi === null ? "—" : result.dqi.toFixed(1)}
        </span>
        {result.grade && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              GRADE_TONE[result.grade.label],
            )}
          >
            {result.grade.label}
          </span>
        )}
        <Popover>
          <PopoverTrigger className="ml-auto inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-muted">
            {t("details")} <ChevronDown className="h-3.5 w-3.5" />
          </PopoverTrigger>
          <PopoverContent align="start" side="bottom" className="w-[400px] p-0">
            <ScoreDetails />
          </PopoverContent>
        </Popover>
      </div>
      <div className="text-xs text-muted-foreground">
        DQI · {result.rowCount.toLocaleString()} {t("records")} · {result.rulesRun} {t("rulesRan")}{" "}
        · {result.notApplicable.length} {t("doNotApply")}
      </div>
    </div>
  );
}

function ScoreDetails() {
  const dataset = useApp((s) => s.dataset)!;
  const result = useApp((s) => s.result)!;
  const meta = useDisplayMeta()!;
  const setIdColumn = useApp((s) => s.setIdColumn);
  const setPersonColumn = useApp((s) => s.setPersonColumn);

  const columnSelect = (
    label: string,
    hint: string,
    value: string | null,
    onChange: (c: string | null) => void,
  ) => (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span>
        <span className="font-medium text-foreground">{label}</span>
        <span className="block text-muted-foreground">{hint}</span>
      </span>
      <select
        className="h-7 max-w-[190px] rounded-md border bg-card px-1.5 font-mono text-[12px] text-foreground"
        value={value ?? NONE}
        onChange={(e) => onChange(e.target.value === NONE ? null : e.target.value)}
      >
        <option value={NONE}>none</option>
        {dataset.columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">Data Quality Index by dimension</div>
        <p className="text-xs text-muted-foreground">
          The DQI is the weighted average of the four scored dimensions that apply to this file.
          Each score is the share of records with no problem in that dimension.
        </p>
      </div>
      <div className="flex flex-col divide-y">
        {DIMENSIONS.map(({ dimension, weight, blurb }) => {
          const d = result.dimensions[dimension];
          const reported = weight === 0;
          const tone =
            d.score === null ? "" : d.score >= 90 ? "bg-ok" : d.score >= 70 ? "bg-rev" : "bg-err";
          return (
            <div key={dimension} className={cn("px-4 py-2", reported && "bg-muted/60")}>
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold">{dimension}</span>
                <span className="text-[11.5px] text-muted-foreground">
                  {reported ? "reported only" : `${weight}% weight`}
                </span>
                <span className="ml-auto text-[15px] font-bold tabular-nums">
                  {d.score === null ? (
                    <span className="font-medium text-muted-foreground">n/a</span>
                  ) : (
                    d.score.toFixed(1)
                  )}
                </span>
              </div>
              <div className="my-1 h-1.5 overflow-hidden rounded-full bg-muted">
                {d.score !== null && (
                  <div
                    className={cn("h-full rounded-full", tone)}
                    style={{ width: `${d.score}%` }}
                  />
                )}
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                {blurb}.{" "}
                {d.assessed
                  ? `${d.flagged.toLocaleString()} flagged by ${d.checks} check${d.checks === 1 ? "" : "s"}.`
                  : "No check applies to this file."}
                {INTENSITY_DIMENSIONS.includes(dimension) && d.meanIntensity
                  ? ` ${fmt(d.meanIntensity)} issues per flagged record.`
                  : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2.5 border-t px-4 py-3">
        {columnSelect("ID column", "Shown next to every flagged row", meta.idColumn, setIdColumn)}
        {columnSelect(
          "Entered by",
          "Groups issues in the By person tab",
          meta.personColumn,
          setPersonColumn,
        )}
      </div>
    </div>
  );
}
