import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  err: "bg-err-soft text-err",
  rev: "bg-rev-soft text-rev",
  ok: "bg-ok-soft text-ok",
  info: "bg-primary-soft text-primary",
} as const;

export function Tag({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: "err" | "rev" | "ok" | "na" }) {
  const bg = { err: "bg-err", rev: "bg-rev", ok: "bg-ok", na: "bg-border" }[tone];
  return <span aria-hidden className={cn("inline-block h-2 w-2 shrink-0 rounded-full", bg)} />;
}
