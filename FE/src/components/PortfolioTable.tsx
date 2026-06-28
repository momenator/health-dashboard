import { Link } from "@tanstack/react-router";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { ArrowUpRight } from "lucide-react";
import { PROJECTS, type Project } from "@/lib/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABEL: Record<Project["status"], string> = {
  success: "On track",
  warning: "Watch",
  danger: "Attention",
};

const STATUS_STYLE: Record<Project["status"], string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/20 text-warning-foreground border-warning/40",
  danger: "bg-danger/15 text-danger border-danger/30",
};

function dqLabel(p: Project) {
  const high = p.dataIssues.filter((i) => i.severity === "high").length;
  if (high > 0) return { text: `${high} high · ${p.dataIssues.length} total`, tone: "danger" as const };
  if (p.dataIssues.length > 0) return { text: `${p.dataIssues.length} open`, tone: "warning" as const };
  return { text: "Clean", tone: "success" as const };
}

function completenessPct(p: Project) {
  const last = p.completeness[p.completeness.length - 1];
  return last?.pct ?? 0;
}

export function PortfolioTable() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">All projects</CardTitle>
        <span className="text-xs text-muted-foreground">Click a row to open the project</span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-5 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 font-medium">Health</th>
                <th className="px-3 py-2.5 font-medium">KPI trend</th>
                <th className="px-3 py-2.5 font-medium">Data quality</th>
                <th className="px-3 py-2.5 font-medium">Reporting</th>
                <th className="px-3 py-2.5 font-medium">Open issues</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {PROJECTS.map((p) => {
                const dq = dqLabel(p);
                const rc = completenessPct(p);
                const rcTone = rc >= 90 ? "text-success" : rc >= 80 ? "text-warning-foreground" : "text-danger";
                return (
                  <tr
                    key={p.id}
                    className="group border-b last:border-b-0 hover:bg-muted/40 transition cursor-pointer"
                    onClick={(e) => {
                      const link = e.currentTarget.querySelector<HTMLAnchorElement>("a[data-row-link]");
                      link?.click();
                    }}
                  >
                    <td className="px-5 py-3">
                      <Link
                        data-row-link
                        to="/projects/$projectId"
                        params={{ projectId: p.id }}
                        className="block"
                      >
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {p.donor}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-semibold tabular-nums">{p.healthScore}</td>
                    <td className="px-3 py-3">
                      <div className="h-8 w-24">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={p.trend}>
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="var(--color-primary)"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          "rounded-md border px-2 py-0.5 text-xs " +
                          (dq.tone === "danger"
                            ? "bg-danger/15 text-danger border-danger/30"
                            : dq.tone === "warning"
                              ? "bg-warning/20 text-warning-foreground border-warning/40"
                              : "bg-success/15 text-success border-success/30")
                        }
                      >
                        {dq.text}
                      </span>
                    </td>
                    <td className={"px-3 py-3 font-medium tabular-nums " + rcTone}>{rc}%</td>
                    <td className="px-3 py-3 tabular-nums">{p.dataIssues.length}</td>
                    <td className="px-3 py-3">
                      <span className={"rounded-full border px-2 py-0.5 text-xs " + STATUS_STYLE[p.status]}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
