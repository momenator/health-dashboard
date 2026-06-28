import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { AttentionBanner } from "@/components/AttentionBanner";
import { ProjectCard } from "@/components/ProjectCard";
import { PortfolioTable } from "@/components/PortfolioTable";
import { PORTFOLIO_KPIS, PROJECTS } from "@/lib/projects";
import { FieldEventsSection } from "@/components/FieldEventsSection";

export const Route = createFileRoute("/_app/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio Overview · M&E Copilot" },
      {
        name: "description",
        content:
          "Cross-project view of all Doctors for Madagascar healthcare projects — what changed, what needs attention, and what is on track.",
      },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A copilot view across all 5 Doctors for Madagascar projects · Q4 2024 reporting period
        </p>
      </div>

      <FieldEventsSection />

      <AttentionBanner />

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {PORTFOLIO_KPIS.map((k) => (
          <Card key={k.key}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                {k.label}
              </div>
              <div className="mt-2 text-xl font-semibold tabular-nums">{k.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{k.delta}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold tracking-tight">Projects</h2>
          <span className="text-xs text-muted-foreground">Click a card to open the project</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROJECTS.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </div>

      <PortfolioTable />
    </div>
  );
}
