export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[12px] font-bold tracking-wide text-primary-foreground">
        DfM
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">Data Check</div>
        <div className="text-xs text-muted-foreground">Doctors for Madagascar · M&amp;E</div>
      </div>
    </div>
  );
}
