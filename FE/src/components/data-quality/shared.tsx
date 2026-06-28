import { useRef, type ReactNode } from "react";
import { toPng } from "html-to-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
  downloadName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  downloadName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handleDownload = async () => {
    if (!ref.current) return;
    const dataUrl = await toPng(ref.current, {
      backgroundColor: "white",
      pixelRatio: 2,
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${downloadName ?? title.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={handleDownload}
            title="Download as PNG"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent ref={ref} className={cn("pt-2", className)}>
        {children}
      </CardContent>
    </Card>
  );
}

export function SeverityPill({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  const cls =
    s === "critical"
      ? "bg-danger/15 text-danger border-danger/30"
      : s === "warning"
        ? "bg-warning/20 text-warning-foreground border-warning/40"
        : s === "info"
          ? "bg-primary/10 text-primary border-primary/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
        cls,
      )}
    >
      {severity || "—"}
    </span>
  );
}
