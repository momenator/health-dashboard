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
import { PROJECTS } from "@/lib/projects";

export const Route = createFileRoute("/_app/report")({
  head: () => ({
    meta: [
      { title: "Generate Report · M&E Copilot" },
      { name: "description", content: "Generate donor or annual reports across projects." },
    ],
  }),
  component: ReportPage,
});

const PERIODS = ["Q4 2024 (Oct–Dec)", "H2 2024 (Jul–Dec)", "Full year 2024"];
const REPORT_TYPES = ["Annual portfolio report", "Donor report", "Internal review"];

function ReportPage() {
  const [scope, setScope] = useState<string>("portfolio");
  const [period, setPeriod] = useState(PERIODS[2]);
  const [type, setType] = useState(REPORT_TYPES[0]);
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setGenerated(false);
    await new Promise((r) => setTimeout(r, 1400));
    setLoading(false);
    setGenerated(true);
    toast.success(`${type} drafted`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Generate Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Draft a polished report for one project or for the whole portfolio.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Scope</label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portfolio">Portfolio (all projects)</SelectItem>
                {PROJECTS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <Button onClick={generate} disabled={loading}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            {loading ? "Drafting…" : generated ? "Regenerate" : "Generate Report"}
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
              Pick a scope, period, and report type, then click Generate to draft a complete report.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Compiling KPIs, trend analysis, data quality notes, recommendations, and impact stories…</CardContent></Card>
      )}

      {generated && !loading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Doctors for Madagascar · {type}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {period} · Drafted by M&E Copilot
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
            <Section title="Executive Summary">
              In {period}, Doctors for Madagascar operated 5 healthcare projects reaching
              approximately 47,860 beneficiaries across the north, highlands, east, south, and
              southwest of Madagascar. MCHP and PROFESS exceeded targets; MIRAY TB and TIA LONGO
              remained stable with localised concerns; MAFY faced a supply-driven crisis in two
              southern districts.
            </Section>
            <Section title="Project highlights">
              <ul className="list-disc pl-5 space-y-1">
                {PROJECTS.map((p) => (
                  <li key={p.id}>
                    <span className="font-medium">{p.name} ({p.donor}):</span> {p.impactStory}
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Cross-cutting risks">
              <ul className="list-disc pl-5 space-y-1">
                <li>RUTF supply pipeline (MAFY) — emergency resupply triggered for Tsihombe and Beloha.</li>
                <li>Rifampicin stock (MIRAY TB) — two sites below 30 days of cover.</li>
                <li>Outreach resilience (TIA LONGO) — Aug–Sep fuel shortage exposed weak fuel buffers.</li>
                <li>Reporting completeness — 1 facility (Anjozorobe Rural) silent for 2 months.</li>
              </ul>
            </Section>
            <Section title="Recommendations">
              <ul className="list-disc pl-5 space-y-1">
                <li>Pre-position therapeutic food and TB drugs ahead of Q1 lean season.</li>
                <li>Pre-position fuel reserves before cyclone season.</li>
                <li>Field visits to silent facilities in MCHP and MAFY.</li>
                <li>Scale SMS referral reminders and refreshed CHW curriculum.</li>
              </ul>
            </Section>
            <Section title="Impact Story" highlight>
              Across five projects and five regions, Doctors for Madagascar continued to expand
              access to essential healthcare for some of Madagascar's most remote communities. From
              a young mother completing antenatal care in Manjakandriana to a newly certified
              community health worker screening her first households in Betioky-Sud, the year
              showed how community-based delivery and rigorous monitoring multiply each other's
              impact.
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
