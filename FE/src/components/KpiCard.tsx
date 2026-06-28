import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-primary bg-primary/10",
    success: "text-success bg-success/15",
    warning: "text-warning-foreground bg-warning/20",
    danger: "text-danger bg-danger/15",
  }[tone];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
            {delta && <div className="mt-1 text-xs text-muted-foreground">{delta}</div>}
          </div>
          {Icon && (
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneClass)}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
