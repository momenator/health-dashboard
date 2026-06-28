import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileDown, FileText, Presentation, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getContextForProject } from "@/lib/external-context";
import { ExternalContextChip } from "@/components/ExternalContextPanel";

export const Route = createFileRoute("/_app/projects/$projectId/report")({
  component: ProjectReportPage,
});

import { useParams } from "@tanstack/react-router";
import { getProject, type Project } from "@/lib/projects";
function useProject(): Project {
  const { projectId } = useParams({ from: "/_app/projects/$projectId" });
  return getProject(projectId)!;
}

const PERIODS = ["Q4 2024 (Oct–Dec)", "Q3 2024 (Jul–Sep)", "H2 2024 (Jul–Dec)", "Full year 2024"];
const REPORT_TYPES = ["Monthly", "Quarterly", "Annual", "Donor report", "Internal report"];

function ProjectReportPage() {
  const project = useProject();
  const [period, setPeriod] = useState(PERIODS[0]);
  const [type, setType] = useState(REPORT_TYPES[0]);
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  const events = getContextForProject(project.id);
  const contextEvent = events[0];

  const generate = async () => {
    setLoading(true);
    setGenerated(false);
    await new Promise((r) => setTimeout(r, 1400));
    setLoading(false);
    setGenerated(true);
    toast.success(`${type} drafted for ${project.name}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reporting period</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Report type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <Button onClick={generate} disabled={loading}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            {loading ? "Drafting report…" : generated ? "Regenerate" : "Generate Report"}
          </Button>
        </CardContent>
      </Card>

      {!generated && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold">No report yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md">
              Choose the period and report type, then click Generate to draft a complete report for{" "}
              {project.name}.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Drafting executive summary, KPI tables, trend analysis, and impact story…</CardContent></Card>
      )}

      {generated && !loading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>{project.name} · {type}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {period} · Prepared for {project.donor} · Drafted by M&E Copilot
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toast.success("PDF export ready (demo)")}>
                <FileDown className="mr-1 h-4 w-4" /> Export PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast.success("PowerPoint export ready (demo)")}>
                <Presentation className="mr-1 h-4 w-4" /> Export PPT
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Section title="Executive Summary">{project.impactStory}</Section>

            <Section title="KPI Overview">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="py-2">Indicator</th>
                    <th className="py-2">Value</th>
                    <th className="py-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {project.kpis.map((k) => (
                    <tr key={k.key} className="border-t">
                      <td className="py-2">{k.label}</td>
                      <td className="py-2 font-semibold tabular-nums">{k.value}</td>
                      <td className="py-2 text-muted-foreground">{k.delta ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Trend Analysis">
              <ul className="list-disc pl-5 space-y-1">
                {project.whatChanged.map((c, i) => <li key={i}>{c.text}</li>)}
              </ul>
              {contextEvent && (
                <div className="mt-3">
                  <ExternalContextChip event={contextEvent} />
                </div>
              )}
            </Section>

            <Section title="Data Quality Notes">
              {project.dataIssues.length === 0 ? (
                <p>No outstanding data quality issues for this reporting period.</p>
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  {project.dataIssues.map((i) => (
                    <li key={i.id}>
                      <span className="font-medium">{i.location}:</span> {i.issue} —{" "}
                      <span className="text-muted-foreground">{i.action}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Recommendations">
              <ul className="list-disc pl-5 space-y-1">
                {project.nextSteps.map((s) => (
                  <li key={s.id}>
                    <span className="font-medium">{s.title}</span> ({s.owner}) — {s.why}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Impact Story" highlight>
              {project.impactStory}{" "}
              <span className="block mt-2 italic text-foreground/80">{project.vignette}</span>
            </Section>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  highlight,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <section
      className={
        highlight
          ? "rounded-xl border border-primary/30 bg-primary/5 p-5"
          : "border-t pt-5"
      }
    >
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="text-sm text-foreground/90 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
