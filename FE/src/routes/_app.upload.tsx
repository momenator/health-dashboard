import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  Lock,
  MessageSquare,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Upload,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPublicContext,
  uploadDataset,
  type PublicContextResponse,
  type UploadSanitizationResponse,
} from "@/lib/api";
import { PROJECTS, type Project } from "@/lib/projects";

export const Route = createFileRoute("/_app/upload")({
  head: () => ({
    meta: [
      { title: "Upload · M&E Copilot" },
      {
        name: "description",
        content:
          "Upload and sanitize M&E datasets before quality checks, Q&A, and report generation.",
      },
    ],
  }),
  component: UploadWorkflow,
});

const STEPS = [
  { key: "upload", label: "Upload data", icon: Upload },
  { key: "privacy", label: "Privacy scan", icon: ShieldCheck },
  { key: "ready", label: "Dataset ready", icon: Database },
  { key: "quality", label: "Review quality", icon: SearchCheck },
  { key: "report", label: "Use in reports", icon: FileText },
] as const;

function UploadWorkflow() {
  const [projectId, setProjectId] = useState(PROJECTS[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [scan, setScan] = useState<UploadSanitizationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [context, setContext] = useState<PublicContextResponse | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const project = useMemo(
    () => PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0],
    [projectId],
  );
  const progress = scan ? 100 : file ? 20 : 0;
  const changesText = useMemo(
    () =>
      [
        project.oneLineChange,
        ...project.whatChanged.map((item) => item.text),
        ...project.nextSteps.map((step) => step.why),
      ].join("\n"),
    [project],
  );

  useEffect(() => {
    if (!scan) {
      setContext(null);
      setContextError(null);
      return;
    }
    let cancelled = false;
    setContextLoading(true);
    setContextError(null);
    getPublicContext({
      projectId: project.id,
      region: project.region,
      changes: changesText,
      limit: 5,
    })
      .then((result) => {
        if (!cancelled) setContext(result);
      })
      .catch((e) => {
        if (!cancelled) setContextError(e instanceof Error ? e.message : "Context lookup failed");
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scan, project.id, project.region, changesText]);

  const startUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setScan(null);
    setActiveStep(1);
    try {
      const result = await uploadDataset(file);
      setScan(result);
      setActiveStep(2);
      toast.success("Privacy scan complete");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setActiveStep(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Upload className="h-3.5 w-3.5" /> Dataset upload
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Upload Dataset</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Upload CSV or XLSX exports. The app removes PII first, registers a sanitized dataset,
            then links it to data quality, Q&A, and report drafting workflows.
          </p>
        </div>
        <div className="w-full sm:w-[260px]">
          <label className="text-xs font-medium text-muted-foreground">Project context</label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECTS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <WorkflowSteps activeStep={activeStep} complete={Boolean(scan)} />
          <Progress value={progress} className="mt-4" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <UploadPanel
          file={file}
          scan={scan}
          error={error}
          uploading={uploading}
          onFile={setFile}
          onUpload={startUpload}
        />
        <PrivacyPanel scan={scan} uploading={uploading} />
      </div>

      <LockedSection unlocked={Boolean(scan)} title="Use sanitized dataset">
        <DatasetHub
          project={project}
          scan={scan}
          context={context}
          contextLoading={contextLoading}
          contextError={contextError}
        />
      </LockedSection>
    </div>
  );
}

function WorkflowSteps({ activeStep, complete }: { activeStep: number; complete: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {STEPS.map((step, index) => {
        const done = complete || index < activeStep;
        const active = !complete && index === activeStep;
        return (
          <div
            key={step.key}
            className={
              "flex min-h-16 items-center gap-2 rounded-md border px-3 py-2 " +
              (done
                ? "border-success/30 bg-success/10"
                : active
                  ? "border-primary/40 bg-primary/10"
                  : "bg-muted/30")
            }
          >
            <div
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md " +
                (done ? "bg-success text-success-foreground" : "bg-card text-muted-foreground")
              }
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
            </div>
            <div className="min-w-0 text-sm font-medium">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function UploadPanel({
  file,
  scan,
  error,
  uploading,
  onFile,
  onUpload,
}: {
  file: File | null;
  scan: UploadSanitizationResponse | null;
  error: string | null;
  uploading: boolean;
  onFile: (file: File | null) => void;
  onUpload: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4 text-primary" /> Upload data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center transition hover:border-primary/40 hover:bg-primary/5">
          <Upload className="h-7 w-7 text-muted-foreground" />
          <span className="mt-3 text-sm font-medium">
            {file ? file.name : "Choose CSV or XLSX file"}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">CSV or XLSX</span>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          />
        </label>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Upload failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {scan && (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Sanitized dataset ready</AlertTitle>
            <AlertDescription>{scan.table_name}</AlertDescription>
          </Alert>
        )}

        <Button className="w-full" disabled={!file || uploading} onClick={onUpload}>
          {uploading ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Scanning
            </>
          ) : (
            <>
              Start privacy scan <ArrowRight className="ml-1.5 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function PrivacyPanel({
  scan,
  uploading,
}: {
  scan: UploadSanitizationResponse | null;
  uploading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" /> Privacy scan
        </CardTitle>
      </CardHeader>
      <CardContent>
        {uploading && (
          <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Removing sensitive fields before analysis
          </div>
        )}

        {!uploading && !scan && (
          <div className="flex min-h-56 flex-col items-center justify-center text-center text-muted-foreground">
            <Lock className="h-8 w-8" />
            <div className="mt-3 text-sm">No raw data is sent downstream before this scan passes.</div>
          </div>
        )}

        {scan && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <PrivacyMetric label="Rows" value={scan.row_count.toLocaleString()} />
              <PrivacyMetric label="Removed" value={String(scan.removed_columns.length)} />
              <PrivacyMetric label="Redacted cells" value={String(scan.redacted_cells)} />
              <PrivacyMetric label="Retained" value={String(scan.retained_columns.length)} />
            </div>

            <ColumnList title="Removed before AI" columns={scan.removed_columns} tone="danger" />
            <ColumnList title="Pseudonymized" columns={scan.pseudonymized_columns} tone="warning" />
            <ColumnList title="Available for analysis" columns={scan.retained_columns.slice(0, 18)} />

            <div className="text-xs text-muted-foreground">
              Sanitizer: {scan.external_script_used ? "configured PII script + safety pass" : "built-in safety pass"}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrivacyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ColumnList({
  title,
  columns,
  tone = "default",
}: {
  title: string;
  columns: string[];
  tone?: "default" | "danger" | "warning";
}) {
  if (columns.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {columns.map((column) => (
          <Badge
            key={column}
            variant="outline"
            className={
              tone === "danger"
                ? "border-danger/30 bg-danger/10 text-danger"
                : tone === "warning"
                  ? "border-warning/40 bg-warning/20 text-warning-foreground"
                  : "bg-muted/40 text-muted-foreground"
            }
          >
            {column}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function LockedSection({
  unlocked,
  title,
  children,
}: {
  unlocked: boolean;
  title: string;
  children: React.ReactNode;
}) {
  if (!unlocked) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-28 items-center gap-3 p-5 text-muted-foreground">
          <Lock className="h-5 w-5" />
          <div>
            <div className="text-sm font-medium text-foreground">{title}</div>
            <div className="text-xs">Locked until the privacy scan passes.</div>
          </div>
        </CardContent>
      </Card>
    );
  }
  return children;
}

function DatasetHub({
  project,
  scan,
  context,
  contextLoading,
  contextError,
}: {
  project: Project;
  scan: UploadSanitizationResponse | null;
  context: PublicContextResponse | null;
  contextLoading: boolean;
  contextError: string | null;
}) {
  const datasetParams = new URLSearchParams({
    dataset: scan?.table_name ?? "",
    project: project.id,
  }).toString();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4 text-primary" /> Sanitized dataset ready
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>{scan?.table_name ?? "Sanitized upload"} is available downstream</AlertTitle>
          <AlertDescription>
            Use the privacy-clean dataset with {project.name}. Raw uploaded columns removed by the
            scan are not passed to quality review, chat, or report generation.
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 sm:grid-cols-3">
          <PrivacyMetric label="Rows ready" value={String(scan?.row_count.toLocaleString() ?? "0")} />
          <PrivacyMetric label="Sanitized file" value={scan?.sanitized_filename ?? "ready"} />
          <PrivacyMetric label="Project context" value={project.region} />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <ActionCard
            href={`/data-quality?${datasetParams}`}
            icon={SearchCheck}
            title="Data Quality"
            description="Review missing values, inconsistent indicators, and records that need correction before reporting."
            cta="Open checks"
          />
          <ActionCard
            href={`/ask?${datasetParams}`}
            icon={MessageSquare}
            title="Ask Your Data"
            description="Ask French or English questions against the sanitized dataset and current project context."
            cta="Ask questions"
          />
          <ActionCard
            href={`/report?${datasetParams}`}
            icon={FileText}
            title="Generate Report"
            description="Draft donor-ready sections, situation explanations, and impact story material from clean data."
            cta="Draft report"
          />
        </div>

        <PublicContextPanel
          context={context}
          loading={contextLoading}
          error={contextError}
        />
        <div className="text-xs text-muted-foreground">
          Evidence source: sanitized upload {scan?.sanitized_filename}; selected project indicators
          for {project.reportingPeriod}.
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
  cta,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <div className="flex min-h-44 flex-col rounded-md border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Button asChild size="sm" className="mt-4 w-full justify-between">
        <a href={href}>
          {cta}
          <ArrowRight className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}

function PublicContextPanel({
  context,
  loading,
  error,
}: {
  context: PublicContextResponse | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-primary" /> Public context signals
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Public Madagascar news and agency updates matched to this dataset and project context.
            These are possible explanations, not confirmed causes.
          </p>
        </div>
        {context && (
          <Badge variant="outline" className="shrink-0 capitalize">
            {context.generated_by}
          </Badge>
        )}
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Fetching public context
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Context lookup failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && context?.items.length === 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          No relevant public context signals were found for this project and reporting window.
        </div>
      )}

      {context && context.items.length > 0 && (
        <div className="mt-4 space-y-3">
          {context.items.map((item) => (
            <a
              key={item.id}
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border bg-muted/20 p-3 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {item.category.replace("_", " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {item.date} · {item.source} · confidence {item.confidence}
                </span>
              </div>
              <div className="mt-2 text-sm font-medium">{item.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{item.relevance}</div>
            </a>
          ))}
          <div className="text-xs text-muted-foreground">{context.note}</div>
        </div>
      )}
    </div>
  );
}
