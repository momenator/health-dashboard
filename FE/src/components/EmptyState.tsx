import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  title = "Nothing to show yet",
  description = "Open the Portfolio to pick a project to work on.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-14 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Inbox className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p>
        <Button asChild className="mt-5">
          <Link to="/portfolio">Open Portfolio</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
