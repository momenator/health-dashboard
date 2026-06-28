import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { getProject } from "@/lib/projects";

export const Route = createFileRoute("/_app/projects/$projectId")({
  loader: ({ params }) => {
    const project = getProject(params.projectId);
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.project.name ?? "Project"} · M&E Copilot` },
      {
        name: "description",
        content:
          loaderData?.project.fullName ??
          "Project workspace for a Doctors for Madagascar program.",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="py-16 text-center text-muted-foreground">Project not found.</div>
  ),
  errorComponent: () => (
    <div className="py-16 text-center text-muted-foreground">Could not load this project.</div>
  ),
  component: ProjectLayout,
});

function ProjectLayout() {
  const { project } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{project.donor}</Badge>
            <Badge variant="secondary">{project.region}</Badge>
            <span className="text-xs text-muted-foreground">{project.reportingPeriod}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {project.name}{" "}
            <span className="text-base text-muted-foreground font-normal">
              · {project.fullName}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{project.focus}</p>
        </div>
      </div>
      <ProjectSubnav projectId={project.id} />
      <Outlet />
    </div>
  );
}
