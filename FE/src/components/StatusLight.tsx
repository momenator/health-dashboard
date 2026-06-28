import { cn } from "@/lib/utils";

export type StatusKind = "success" | "warning" | "danger";

const STYLES: Record<StatusKind, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/20 text-warning-foreground border-warning/40",
  danger: "bg-danger/15 text-danger border-danger/30",
};

const DOT: Record<StatusKind, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function StatusLight({
  status,
  label,
  note,
}: {
  status: StatusKind;
  label: string;
  note?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 flex items-start gap-3",
        STYLES[status],
      )}
    >
      <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", DOT[status])} />
      <div className="flex-1">
        <div className="text-sm font-semibold">{label}</div>
        {note && <div className="text-xs opacity-80 mt-0.5">{note}</div>}
      </div>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: "high" | "medium" | "low" }) {
  const map = {
    high: "bg-danger/15 text-danger border-danger/30",
    medium: "bg-warning/20 text-warning-foreground border-warning/40",
    low: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
        map[severity],
      )}
    >
      {severity}
    </span>
  );
}
