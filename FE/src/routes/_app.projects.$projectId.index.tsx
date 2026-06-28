import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Minus,
  Sparkles,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/KpiCard";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { StatusLight } from "@/components/StatusLight";
import { MadagascarMap } from "@/components/MadagascarMap";
import { ExternalContextPanel } from "@/components/ExternalContextPanel";
import { getContextForProject } from "@/lib/external-context";

export const Route = createFileRoute("/_app/projects/$projectId/")({
  component: ProjectOverview,
});

import { useParams } from "@tanstack/react-router";
import { getProject, type Project } from "@/lib/projects";
function useProject(): Project {
  const { projectId } = useParams({ from: "/_app/projects/$projectId" });
  return getProject(projectId)!;
}

const axisColor = "var(--color-muted-foreground)";
const gridColor = "var(--color-border)";
const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-foreground)",
};

function ProjectOverview() {
  const project = useProject();
  const events = getContextForProject(project.id);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <HealthScoreCard score={project.healthScore} />
        </div>
        <div className="lg:col-span-2 grid sm:grid-cols-2 gap-3">
          {project.statusLights.map((s) => (
            <StatusLight key={s.label} {...s} />
          ))}
        </div>
      </div>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wide text-primary">
                AI Summary · {project.reportingPeriod}
              </div>
              <h2 className="mt-0.5 text-base font-semibold">
                {project.name}: {project.oneLineChange}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                {project.impactStory}
              </p>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Confidence: medium · Generated from {project.kpis.length} indicators across{" "}
                {project.districts.length} districts. Always validate before reporting externally.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {project.kpis.map((k) => (
          <KpiCard
            key={k.key}
            label={k.label}
            value={k.value}
            delta={k.delta}
            tone={k.tone}
            icon={k.icon}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> What changed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {project.whatChanged.map((c, idx) => (
                <li key={idx} className="flex gap-3 items-start text-sm">
                  <DirectionIcon dir={c.direction} />
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-foreground" /> Recommended next steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.nextSteps.map((s) => (
              <div key={s.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      "rounded-md border px-2 py-0.5 capitalize " +
                      (s.priority === "high"
                        ? "bg-danger/15 text-danger border-danger/30"
                        : s.priority === "medium"
                          ? "bg-warning/20 text-warning-foreground border-warning/40"
                          : "bg-muted text-muted-foreground border-border")
                    }
                  >
                    {s.priority}
                  </span>
                  <span className="text-muted-foreground">{s.owner}</span>
                </div>
                <div className="mt-1.5 text-sm font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.why}</div>
              </div>
            ))}
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to="/projects/$projectId/data-quality" params={{ projectId: project.id }}>
                Open data quality issues <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title={project.trendLabel}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={project.trend} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={project.byDistrictLabel}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={project.byDistrict} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="district" stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-12} dy={6} />
              <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Reporting completeness (last 6 months, %)">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={project.completeness} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id={`rc-${project.id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} domain={[60, 100]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="pct" stroke="var(--color-primary)" strokeWidth={2.5} fill={`url(#rc-${project.id})`} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <SignatureChartCard project={project} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Geographic coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <MadagascarMap />
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <ExternalContextPanel events={events} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SignatureChartCard({ project }: { project: Project }) {
  const sig = project.signature;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{sig.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {sig.kind === "donut" && (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={sig.data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                {sig.data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
        {sig.kind === "funnel" && (
          <div className="space-y-2 py-2">
            {sig.steps.map((s, i) => {
              const max = sig.steps[0].value;
              const pct = (s.value / max) * 100;
              return (
                <div key={s.name}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.value.toLocaleString()} ({Math.round(pct)}%)
                    </span>
                  </div>
                  <div className="mt-1 h-3 rounded-md bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-md"
                      style={{
                        width: `${pct}%`,
                        background: `var(--color-chart-${(i % 5) + 1})`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {sig.kind === "stacked" && (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sig.data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="a" name={sig.data[0]?.aName} fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="b" name={sig.data[0]?.bName} fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function DirectionIcon({ dir }: { dir: "up" | "down" | "flat" | "alert" }) {
  if (dir === "up")
    return <ArrowUpRight className="h-4 w-4 mt-0.5 shrink-0 text-success" />;
  if (dir === "down")
    return <ArrowDownRight className="h-4 w-4 mt-0.5 shrink-0 text-warning-foreground" />;
  if (dir === "alert")
    return <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-danger" />;
  return <Minus className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />;
}
