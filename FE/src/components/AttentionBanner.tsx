import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PROJECTS } from "@/lib/projects";

export function AttentionBanner() {
  const attention = PROJECTS.filter((p) => p.needsAttention).slice(0, 3);
  if (attention.length === 0) return null;

  return (
    <Card className="border-warning/40 bg-warning/10">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-warning-foreground" />
          <span>What needs your attention today</span>
        </div>
        <ul className="mt-3 space-y-2">
          {attention.map((p) => (
            <li key={p.id}>
              <Link
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                className="group flex items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-primary/40 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    <span className="text-primary">{p.name}</span>
                    <span className="text-muted-foreground"> — {p.oneLineChange}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {p.nextSteps[0]?.title ?? "Review project status"}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0 group-hover:text-primary transition" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
