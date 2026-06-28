import { Link } from "@tanstack/react-router";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusLight } from "@/components/StatusLight";
import type { Project } from "@/lib/projects";

export function ProjectCard({ project }: { project: Project }) {
  const trendUp = project.healthScore >= 75;
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="block group"
    >
      <Card className="h-full transition group-hover:border-primary/40 group-hover:shadow-md">
        <CardContent className="p-5 flex flex-col gap-4 h-full">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {project.donor} · {project.region}
              </div>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">{project.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{project.focus}</p>
            </div>
            <HealthRing score={project.healthScore} />
          </div>

          <StatusLight
            status={project.status}
            label={project.oneLineChange}
            note={`${project.districts.length} districts · ${project.reportingPeriod}`}
          />

          <div className="mt-auto flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              {trendUp ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-warning" />
              )}
              {project.needsAttention ? "Needs attention" : "On track"}
            </span>
            <span className="inline-flex items-center gap-1 text-primary font-medium group-hover:gap-2 transition-all">
              Open <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function HealthRing({ score }: { score: number }) {
  const stroke =
    score >= 80 ? "var(--color-success)" : score >= 65 ? "var(--color-warning)" : "var(--color-danger)";
  const circ = 2 * Math.PI * 18;
  const offset = circ - (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 44 44" className="h-14 w-14 -rotate-90">
        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-muted)" strokeWidth="5" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {score}
      </div>
    </div>
  );
}
