import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  ShieldCheck,
  MessageSquare,
  FileText,
  Settings,
  HeartPulse,
  FolderKanban,
  Upload,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { PROJECTS } from "@/lib/projects";

const PORTFOLIO_NAV = [
  { to: "/portfolio", label: "Portfolio Overview", icon: LayoutGrid },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/data-quality", label: "Data Quality", icon: ShieldCheck },
  { to: "/ask", label: "Ask Your Data", icon: MessageSquare },
  { to: "/report", label: "Generate Report", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <Link to="/" className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">M&E Copilot</span>
            <span className="text-xs text-muted-foreground">Doctors for Madagascar</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Portfolio</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PORTFOLIO_NAV.map((item) => {
                const active =
                  pathname === item.to ||
                  (item.to !== "/portfolio" && pathname.startsWith(item.to + "/"));
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.to} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PROJECTS.map((p) => {
                const base = `/projects/${p.id}`;
                const active = pathname === base || pathname.startsWith(base + "/");
                return (
                  <SidebarMenuItem key={p.id}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: p.id }}
                        className="flex items-center gap-2"
                      >
                        <FolderKanban className="h-4 w-4" />
                        <span className="truncate">{p.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
