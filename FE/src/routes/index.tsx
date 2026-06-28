import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ShieldCheck,
  MessageSquare,
  FileText,
  Sparkles,
  HeartPulse,
  ArrowRight,
  Stethoscope,
  LayoutGrid,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const HERO_IMAGE_URL =
  "/__l5e/assets-v1/b147f366-d459-4652-a115-3c7ed342d6b1/DoctorsForMadagascar.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "M&E Copilot · Doctors for Madagascar" },
      {
        name: "description",
        content:
          "AI-powered Monitoring & Evaluation Copilot for Doctors for Madagascar. Reduce reporting effort, surface what changed, and generate donor reports in minutes.",
      },
      { property: "og:title", content: "M&E Copilot · Doctors for Madagascar" },
      {
        property: "og:description",
        content:
          "An AI copilot for project managers monitoring multiple healthcare projects across Madagascar.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "Portfolio Overview",
    body: "See every project at a glance and immediately know which ones need attention today.",
  },
  {
    icon: Activity,
    title: "Project Dashboards",
    body: "Per-project KPIs, what changed, and recommended next steps — not just charts.",
  },
  {
    icon: ShieldCheck,
    title: "Data Quality Guardian",
    body: "Detects missing reports, outliers, impossible values, and duplicates across projects.",
  },
  {
    icon: MessageSquare,
    title: "Ask Your Data",
    body: "Plain-language answers, grounded in project data, with possible external context.",
  },
  {
    icon: AlertCircle,
    title: "External Context",
    body: "Cyclones, outbreaks, fuel shortages, holidays — suggested as possible explanations.",
  },
  {
    icon: FileText,
    title: "Report Generator",
    body: "Draft donor and annual reports — with executive summary, KPIs, and impact stories.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">M&E Copilot</div>
              <div className="text-xs text-muted-foreground">Doctors for Madagascar</div>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild>
              <Link to="/portfolio">
                Open Portfolio <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-12 pb-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <Stethoscope className="h-3.5 w-3.5 text-primary" />
              Built for Doctors for Madagascar
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance md:text-5xl">
              Doctors for Madagascar
              <br />
              Monitoring &amp; Evaluation
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/portfolio">
                  Open Portfolio <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/ask">
                  <Sparkles className="mr-1 h-4 w-4" /> Try the Copilot
                </Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border shadow-lg">
            <img
              src={HERO_IMAGE_URL}
              alt="Doctors for Madagascar community health worker leading a session with villagers"
              className="aspect-[4/3] h-auto w-full object-cover"
              loading="eager"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-2xl font-semibold tracking-tight">What it does</h2>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardContent className="p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t bg-card/40">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>Built for the AI4Good Hackathon at TUM</span>
          <span>Prototype · sample data only</span>
        </div>
      </footer>
    </div>
  );
}
