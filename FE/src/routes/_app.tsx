import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card/60 backdrop-blur px-3">
            <SidebarTrigger />
            <div className="flex-1" />
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              AI Copilot · Demo workspace
            </Badge>
          </header>
          <main className="flex-1 p-6 lg:p-8 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
