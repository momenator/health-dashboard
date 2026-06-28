import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ShieldCheck, MessageSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "", label: "Overview", icon: LayoutDashboard },
  { to: "/data-quality", label: "Data Quality", icon: ShieldCheck },
  { to: "/ask", label: "Ask Your Data", icon: MessageSquare },
  { to: "/report", label: "Generate Report", icon: FileText },
] as const;

export function ProjectSubnav({ projectId }: { projectId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/projects/${projectId}`;
  return (
    <nav className="flex flex-wrap gap-1 border-b -mb-px">
      {TABS.map((tab) => {
        const target = base + tab.to;
        const active =
          tab.to === ""
            ? pathname === base || pathname === base + "/"
            : pathname.startsWith(target);
        return (
          <Link
            key={tab.to}
            to={target}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
