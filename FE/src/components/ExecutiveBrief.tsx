import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { PROJECTS } from "@/lib/projects";

/**
 * AI-generated portfolio-level executive brief.
 * In production this would stream from the AI gateway.
 */
export function ExecutiveBrief() {
  const attention = PROJECTS.filter((p) => p.needsAttention);
  const onTrack = PROJECTS.length - attention.length;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 space-y-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-primary">
                AI Executive Brief · Q4 2024
              </div>
              <h2 className="mt-0.5 text-base font-semibold">
                {onTrack} of {PROJECTS.length} projects are on track. {attention.length} need your attention this week.
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-foreground/80">
              The portfolio reached <span className="font-semibold text-foreground">47,860 beneficiaries</span> this
              quarter (+8% vs Q3). The strongest gains came from <Link to="/projects/$projectId" params={{ projectId: "mchp" }} className="font-medium text-primary hover:underline">MCHP</Link>{" "}
              (ANC4+ ↑12%) and <Link to="/projects/$projectId" params={{ projectId: "profess" }} className="font-medium text-primary hover:underline">PROFESS</Link>{" "}
              (knowledge tests ↑9pp). Two situations require decisions before the next donor cycle:{" "}
              <Link to="/projects/$projectId" params={{ projectId: "mafy" }} className="font-medium text-primary hover:underline">MAFY</Link>{" "}
              is facing an RUTF stockout in Tsihombe and Beloha that is suppressing SAM admissions, and{" "}
              <Link to="/projects/$projectId" params={{ projectId: "miray-tb" }} className="font-medium text-primary hover:underline">MIRAY TB</Link>{" "}
              shows a localised treatment-success drop in Sambava worth a root-cause review.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-warning-foreground">
                Possible explanation · Cyclone Gamane disruption in the North
              </span>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                Confidence: medium · Needs validation
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
