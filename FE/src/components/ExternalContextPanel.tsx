import { Cloud, AlertCircle, Truck, Calendar, Vote, Sprout, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExternalEvent } from "@/lib/external-context";

const ICONS = {
  cyclone: Cloud,
  outbreak: AlertCircle,
  logistics: Truck,
  holiday: Calendar,
  political: Vote,
  climate: Sprout,
} as const;

export function ExternalContextPanel({ events }: { events: ExternalEvent[] }) {
  if (events.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Possible external context
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Events that overlap this reporting period. Shown as possible explanations, not confirmed
          causes.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {events.map((e) => {
            const Icon = ICONS[e.type];
            return (
              <li key={e.id} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm">
                  <div className="font-medium">
                    {e.title}{" "}
                    <span className="text-xs text-muted-foreground font-normal">· {e.date}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{e.description}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ExternalContextChip({ event }: { event: ExternalEvent }) {
  const Icon = ICONS[event.type];
  return (
    <div className="rounded-lg border-l-2 border-primary bg-primary/5 px-3 py-2 text-sm flex gap-2 items-start">
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div>
        <span className="font-medium">Possible explanation:</span> {event.title} ({event.date}) —{" "}
        <span className="text-muted-foreground">{event.description}</span>
      </div>
    </div>
  );
}
