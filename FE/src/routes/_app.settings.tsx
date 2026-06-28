import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Info, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SCHEMA_MAPPING, STANDARD_INDICATORS } from "@/lib/sample-data";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings · M&E Copilot" },
      { name: "description", content: "Map uploaded columns to standard M&E indicators." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [mapping, setMapping] = useState(SCHEMA_MAPPING);
  const update = (i: number, v: string) =>
    setMapping((m) => m.map((row, idx) => (idx === i ? { ...row, standard: v } : row)));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings · Data Schema</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Map your uploaded columns to standard M&E indicators so the copilot can analyze them
          consistently.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex gap-3 items-start">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm">
            Real Doctors for Madagascar data can be connected once available. This prototype uses
            sample mappings to demonstrate the flow.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b text-xs uppercase tracking-wide text-muted-foreground font-medium">
            <div className="col-span-5">Uploaded column</div>
            <div className="col-span-1" />
            <div className="col-span-6">Standard indicator</div>
          </div>
          {mapping.map((row, i) => (
            <div key={row.uploaded} className="grid grid-cols-12 gap-3 px-5 py-3 border-b last:border-0 items-center">
              <div className="col-span-5 font-mono text-sm">{row.uploaded}</div>
              <div className="col-span-1 flex justify-center text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
              </div>
              <div className="col-span-6">
                <Select value={row.standard} onValueChange={(v) => update(i, v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STANDARD_INDICATORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
