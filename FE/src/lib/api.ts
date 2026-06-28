// Frontend API service layer.
//
// All UI code reads/writes through these functions instead of touching the
// mock data directly. When the backend is ready, swap each function body for
// a fetch() call to the matching endpoint — no UI changes required.
//
// Endpoints planned (backend team is implementing the cloud integration):
//   GET  /projects
//   GET  /portfolio
//   GET  /projects/{id}
//   GET  /data-quality?project=&severity=&period=
//   POST /ask-data        body: { projectId?, question }
//   POST /generate-report body: { projectId, period, type }

import {
  PROJECTS,
  PORTFOLIO_KPIS,
  UPCOMING_REPORTS,
  getProject,
  type Project,
  type ProjectDataIssue,
  type Severity,
} from "@/lib/projects";
import { askCopilot, type CopilotResponse } from "@/lib/ai-mock";
import { getContextForProject, type ExternalEvent } from "@/lib/external-context";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);

type ChatResponse = {
  type: "answer" | "chart" | "recommendation" | "report_text" | "clarification" | "error";
  answer: string;
  chart?: {
    title: string;
    data: Array<Record<string, unknown>>;
  } | null;
  evidence?: Array<{
    table?: string;
    metric?: string | null;
    value?: unknown;
  }> | null;
  quality_note?: string | null;
  suggested_followups?: string[] | null;
};

export type UploadSanitizationResponse = {
  table_name: string;
  original_filename: string;
  sanitized_filename: string;
  row_count: number;
  original_columns: string[];
  retained_columns: string[];
  removed_columns: string[];
  pseudonymized_columns: string[];
  redacted_cells: number;
  external_script_used: boolean;
  message: string;
};

export type PublicContextItem = {
  id: string;
  title: string;
  date: string;
  source: string;
  source_url: string;
  category:
    | "cyclone"
    | "outbreak"
    | "political"
    | "logistics"
    | "climate"
    | "health_system"
    | "economy"
    | "other";
  locations: string[];
  summary: string;
  relevance: string;
  confidence: "high" | "medium" | "low";
};

export type PublicContextResponse = {
  project_id?: string | null;
  region?: string | null;
  source: string;
  generated_by: "groq" | "heuristic";
  items: PublicContextItem[];
  note: string;
};

function toCopilotResponse(response: ChatResponse, projectId?: string): CopilotResponse {
  const project = projectId ? getProject(projectId) : undefined;
  const evidence = response.evidence?.find((item) => item.metric || item.table);
  const qualityNote = response.quality_note ? `\n\n_${response.quality_note}_` : "";

  return {
    answer: `${response.answer}${qualityNote}`,
    chart: response.chart ?? undefined,
    metric: evidence
      ? {
          label: evidence.metric || evidence.table || "Evidence",
          value: String(evidence.value ?? evidence.table ?? "available"),
        }
      : undefined,
    nextStep:
      response.suggested_followups?.[0] ??
      "Ask a follow-up question or open the relevant project view.",
    projectName: project?.name,
  };
}

function errorResponse(error: unknown): CopilotResponse {
  const detail = error instanceof Error ? error.message : "Unknown error";
  return {
    answer: `I could not reach the backend chat API. ${detail}`,
    nextStep: "Make sure the backend is running on http://localhost:8000 and try again.",
  };
}

// ---- GET /projects -------------------------------------------------------
export async function listProjects(): Promise<Project[]> {
  await delay(120);
  return PROJECTS;
}

// ---- GET /portfolio ------------------------------------------------------
export type PortfolioPayload = {
  kpis: typeof PORTFOLIO_KPIS;
  upcomingReports: typeof UPCOMING_REPORTS;
  projects: Project[];
};
export async function getPortfolio(): Promise<PortfolioPayload> {
  await delay(120);
  return { kpis: PORTFOLIO_KPIS, upcomingReports: UPCOMING_REPORTS, projects: PROJECTS };
}

// ---- GET /projects/{id} --------------------------------------------------
export type ProjectDetail = {
  project: Project;
  externalContext: ExternalEvent[];
};
export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  await delay(120);
  const project = getProject(id);
  if (!project) return null;
  return { project, externalContext: getContextForProject(id) };
}

// ---- GET /data-quality ---------------------------------------------------
export type DataQualityFilter = {
  projectId?: string;
  severity?: Severity;
  period?: string;
};
export type DataQualityRow = ProjectDataIssue & { projectId: string; projectName: string };
export async function getDataQuality(filter: DataQualityFilter = {}): Promise<DataQualityRow[]> {
  await delay(120);
  const all: DataQualityRow[] = PROJECTS.flatMap((p) =>
    p.dataIssues.map((i) => ({ ...i, projectId: p.id, projectName: p.name })),
  );
  return all.filter((r) => {
    if (filter.projectId && r.projectId !== filter.projectId) return false;
    if (filter.severity && r.severity !== filter.severity) return false;
    return true;
  });
}

// ---- POST /ask-data ------------------------------------------------------
export type AskRequest = { question: string; projectId?: string };
export async function askData(req: AskRequest): Promise<CopilotResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === "true") {
    return askCopilot(req.question, { projectId: req.projectId });
  }

  const message = req.projectId
    ? `[Project: ${getProject(req.projectId)?.name ?? req.projectId}]\n${req.question}`
    : req.question;

  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        user_context: { role: "frontend" },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
    }

    return toCopilotResponse((await response.json()) as ChatResponse, req.projectId);
  } catch (error) {
    return errorResponse(error);
  }
}

// ---- POST /upload-data ---------------------------------------------------
export async function uploadDataset(file: File): Promise<UploadSanitizationResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/upload-data`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
  }

  return (await response.json()) as UploadSanitizationResponse;
}

// ---- GET /external-context -----------------------------------------------
export async function getPublicContext(req: {
  projectId?: string;
  region?: string;
  changes?: string;
  limit?: number;
}): Promise<PublicContextResponse> {
  const params = new URLSearchParams();
  if (req.projectId) params.set("project_id", req.projectId);
  if (req.region) params.set("region", req.region);
  if (req.changes) params.set("changes", req.changes);
  if (req.limit) params.set("limit", String(req.limit));

  const response = await fetch(`${API_BASE_URL}/external-context?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
  }
  return (await response.json()) as PublicContextResponse;
}

// ---- POST /generate-report -----------------------------------------------
export type ReportType = "Monthly" | "Quarterly" | "Annual" | "Donor report" | "Internal report";
export type GenerateReportRequest = { projectId: string; period: string; type: ReportType };
export async function generateReport(req: GenerateReportRequest) {
  await delay(1400);
  const project = getProject(req.projectId);
  return { ok: true, project: project?.name ?? req.projectId, ...req };
}
