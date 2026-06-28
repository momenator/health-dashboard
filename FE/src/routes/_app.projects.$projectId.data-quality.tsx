import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SeverityBadge } from "@/components/StatusLight";

export const Route = createFileRoute("/_app/projects/$projectId/data-quality")({
  component: ProjectDataQuality,
});

import { useParams } from "@tanstack/react-router";
import { getProject, type Project } from "@/lib/projects";
function useProject(): Project {
  const { projectId } = useParams({ from: "/_app/projects/$projectId" });
  return getProject(projectId)!;
}

function ProjectDataQuality() {
  const project = useProject();
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    setOpen(true);
    await new Promise((r) => setTimeout(r, 1000));
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Data Quality</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {project.dataIssues.length} flagged issue(s) for {project.name}. Each issue explains
            what happened, why it matters, and the recommended action.
          </p>
        </div>
        <Button onClick={generate}>
          <Wand2 className="mr-1.5 h-4 w-4" /> Generate Fix Suggestions
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Severity</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-24">Affected</TableHead>
                <TableHead>Recommended action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {project.dataIssues.map((i) => (
                <TableRow key={i.id}>
                  <TableCell><SeverityBadge severity={i.severity} /></TableCell>
                  <TableCell className="font-medium">{i.issue}</TableCell>
                  <TableCell className="text-muted-foreground">{i.location}</TableCell>
                  <TableCell className="text-xs">{i.type}</TableCell>
                  <TableCell className="tabular-nums">{i.affected}</TableCell>
                  <TableCell className="text-muted-foreground">{i.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>AI fix suggestions · {project.name}</DialogTitle>
            <DialogDescription>
              {generating ? "Generating recommendations…" : "Suggested fixes based on flagged issues."}
            </DialogDescription>
          </DialogHeader>
          {!generating && (
            <ul className="space-y-3 text-sm">
              {project.dataIssues.map((i) => (
                <li key={i.id} className="rounded-md border bg-muted/40 p-3">
                  <span className="font-medium">{i.location}:</span> {i.action}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
