// Simulated AI responses for the Ask Your Data feature.
// Project-aware keyword matching with optional external-context callouts.

import { PROJECTS, getProject, type Project } from "./projects";
import { getContextForText, type ExternalEvent } from "./external-context";

export type CopilotResponse = {
  answer: string;
  metric?: { label: string; value: string };
  chart?: {
    type: "bar" | "line" | "pie" | "table";
    title: string;
    xKey?: string | null;
    yKey?: string | null;
    data: Array<Record<string, unknown>>;
  };
  chartHint?: string;
  nextStep: string;
  context?: ExternalEvent;
  projectName?: string;
};

type Matcher = { match: RegExp; build: (p: Project) => CopilotResponse };

// Per-project response builders. Scope is one project at a time.
const PROJECT_MATCHERS: Record<string, Matcher[]> = {
  "miray-tb": [
    {
      match: /sambava|treatment success|drop|decline/i,
      build: (p) => ({
        answer:
          "Treatment success in **Sambava** fell to 78% (Q3: 86%), driven by a sharp rise in loss-to-follow-up among patients in the second month of treatment. Ambanja and Andapa remain above the 85% target.",
        metric: { label: "Sambava treatment success", value: "78% (↓ 8pp)" },
        chartHint: "treatment-success-by-district",
        nextStep:
          "Send a clinical mentor to Sambava DOT site this week to investigate adherence support and patient follow-up workflows.",
      }),
    },
    {
      match: /rifampicin|stock|supply/i,
      build: (p) => ({
        answer:
          "Rifampicin stock has fallen below 30 days at **Ambanja HC (24 days)** and **Diego II Clinic (27 days)**. At current burn rate, both sites will stock out within the next 4 weeks.",
        metric: { label: "Sites with <30 days stock", value: "2 of 12" },
        nextStep: "Trigger an emergency transfer from the Antsiranana central store within 7 days.",
      }),
    },
    {
      match: /contact|tracing/i,
      build: () => ({
        answer:
          "Contact tracing improved from 2.7 to 3.2 contacts per index case this quarter, above the WHO benchmark of 3.0. Diego II contributed the largest absolute gain (+118 contacts vs Q3).",
        metric: { label: "Contacts per index case", value: "3.2" },
        nextStep: "Maintain the current cadence; consider replicating Diego II's household survey approach.",
      }),
    },
  ],
  mchp: [
    {
      match: /anjozorobe|missing|not reporting/i,
      build: () => ({
        answer:
          "**Anjozorobe Rural Post** has not submitted reports for November or December. A staff transition at the facility was flagged in mid-October, which may be the cause.",
        metric: { label: "Missing reporting periods", value: "2 months" },
        nextStep: "Field visit by the M&E officer to reopen reporting and backfill from paper registers.",
      }),
    },
    {
      match: /dtp3|vaccin|coverage|target/i,
      build: () => ({
        answer:
          "**Ankazobe** is currently 6 percentage points below the 75% DTP3 target. Manjakandriana and Avaradrano are well above target. The decline appears localised to two rural communes in Ankazobe.",
        metric: { label: "Districts below DTP3 target", value: "1 of 5" },
        chartHint: "dtp3-by-district",
        nextStep: "Schedule two additional outreach days in Ankazobe before the end of January.",
      }),
    },
    {
      match: /anc|antenatal|trend/i,
      build: () => ({
        answer:
          "ANC4+ visits have grown month-on-month all year, reaching 2,184 in December — up 12% vs November and 35% vs January. Manjakandriana drove most of the gain.",
        metric: { label: "ANC4+ visits (Dec)", value: "2,184" },
        chartHint: "anc-trend",
        nextStep: "Highlight this trajectory prominently in the BMZ annual report.",
      }),
    },
  ],
  mafy: [
    {
      match: /rutf|stock|tsihombe|beloha/i,
      build: () => ({
        answer:
          "**Tsihombe** and **Beloha** have been out of RUTF since mid-November. Both districts now show zero SAM admissions for the past 3 weeks — almost certainly a reporting artefact of the stockout, not a real drop in cases.",
        metric: { label: "Districts in RUTF stockout", value: "2 of 5" },
        nextStep: "Issue an emergency resupply request and brief ECHO before the next pipeline cycle.",
      }),
    },
    {
      match: /sam|admission|drop/i,
      build: () => ({
        answer:
          "SAM admissions fell 14% vs Q3 (486 vs 565). The drop is concentrated in the two stockout districts; admissions in Amboasary, Ambovombe, and Bekily continued to grow.",
        metric: { label: "SAM admissions (Q4)", value: "486 (↓ 14%)" },
        chartHint: "sam-admissions",
        nextStep: "Re-baseline targets once stockouts are resolved; expect rebound in February.",
      }),
    },
    {
      match: /cure|outcome/i,
      build: () => ({
        answer:
          "Cure rate is 78% overall — just above the Sphere minimum of 75%. Beloha (68%) and Tsihombe (70%) are below standard; both are stockout districts.",
        metric: { label: "Cure rate (Q4)", value: "78%" },
        nextStep: "Plan a post-resupply cohort review for February to confirm recovery.",
      }),
    },
  ],
  "tia-longo": [
    {
      match: /outreach|fuel|august|drop/i,
      build: () => ({
        answer:
          "Mobile outreach sessions dropped 22% in Q3 — concentrated in August and September, during the national fuel shortage. Sessions recovered to baseline by October.",
        metric: { label: "Outreach sessions (Q4)", value: "84 (−22% vs Q3)" },
        chartHint: "outreach-trend",
        nextStep: "Pre-position fuel reserves before the next cyclone season.",
      }),
    },
    {
      match: /referral|complet/i,
      build: () => ({
        answer:
          "Referral completion improved 4 percentage points to **71%** after the SMS reminder pilot in Brickaville. Marolambo remains the lowest at 58%.",
        metric: { label: "Referral completion", value: "71% (+4pp)" },
        nextStep: "Scale SMS reminders to all 14 sites; prioritise Marolambo.",
      }),
    },
    {
      match: /consult|reason|disease/i,
      build: () => ({
        answer:
          "The top three reasons for consultation this quarter are **respiratory infections (28%)**, **malaria (21%)**, and **maternal/child care (17%)**. Malaria cases peaked in November.",
        metric: { label: "Total consultations", value: "18,420" },
        chartHint: "consultation-mix",
        nextStep: "Ensure RDT and ACT stocks are pre-positioned ahead of the next rainy season.",
      }),
    },
  ],
  profess: [
    {
      match: /retention|leaving|ampanihy/i,
      build: () => ({
        answer:
          "12-month CHW retention in **Ampanihy-Ouest** dropped to 81% (vs 88% portfolio average). Exit interviews indicate distance to supervision sites and irregular stipend disbursement as the main drivers.",
        metric: { label: "Ampanihy retention", value: "81% (−7pp)" },
        nextStep: "Pilot mobile supervision and switch Ampanihy stipends to mobile money in Q1 2025.",
      }),
    },
    {
      match: /knowledge|test|pass|curriculum/i,
      build: () => ({
        answer:
          "Knowledge test pass rate climbed to **86%** (+9pp vs Q3) after the refreshed curriculum was rolled out in September. Toliara II posted the strongest gain (+14pp).",
        metric: { label: "Pass rate (Q4)", value: "86%" },
        chartHint: "pass-rate-trend",
        nextStep: "Apply the refreshed curriculum to the Q1 2025 cohort.",
      }),
    },
    {
      match: /train|chw|cohort/i,
      build: () => ({
        answer:
          "118 of 120 targeted CHWs completed full training this quarter. The two who did not complete left for non-program reasons; both districts have replacement candidates ready.",
        metric: { label: "CHWs certified", value: "118 of 120" },
        nextStep: "Schedule replacement training in February 2025.",
      }),
    },
  ],
};

const GENERIC_MATCHERS: Matcher[] = [
  {
    match: /summari[sz]e|donor|report/i,
    build: (p) => ({
      answer: p.impactStory,
      metric: { label: "Health score", value: `${p.healthScore} / 100` },
      nextStep: "Open the Report Generator to produce a donor-ready document with an impact story.",
    }),
  },
  {
    match: /attention|priority|urgent|focus/i,
    build: (p) => {
      const highs = p.nextSteps.filter((s) => s.priority === "high");
      const focus = highs[0] ?? p.nextSteps[0];
      return {
        answer: `Top priority for **${p.name}** is: ${focus.title}. ${focus.why}`,
        metric: { label: "High-priority next steps", value: `${highs.length}` },
        nextStep: `${focus.owner} to own the follow-up.`,
      };
    },
  },
  {
    match: /quality|missing|outlier|suspicious/i,
    build: (p) => {
      const high = p.dataIssues.filter((i) => i.severity === "high").length;
      return {
        answer: `${p.dataIssues.length} data quality issue(s) flagged for ${p.name}, including ${high} high-severity. The most pressing: "${p.dataIssues[0].issue}"`,
        metric: { label: "Flagged issues", value: `${p.dataIssues.length}` },
        nextStep: "Open Data Quality for fix suggestions.",
      };
    },
  },
  {
    match: /change|trend|what happened|month/i,
    build: (p) => ({
      answer: p.whatChanged.map((c) => `- ${c.text}`).join("\n"),
      metric: { label: "Key changes", value: `${p.whatChanged.length}` },
      nextStep: "Drill into the chart most relevant to the change you care about.",
    }),
  },
];

const PORTFOLIO_RESPONSES: { match: RegExp; resp: CopilotResponse }[] = [
  {
    match: /attention|urgent|priority|which projects/i,
    resp: {
      answer:
        "Three projects require attention right now:\n- **MAFY** — RUTF stockout in 2 districts is suppressing SAM admissions.\n- **MIRAY TB** — treatment success dropped 8pp in Sambava and rifampicin stock is <30 days in 2 sites.\n- **TIA LONGO** — outreach capacity hasn't fully recovered from the August fuel shortage.",
      metric: { label: "Projects needing attention", value: "3 of 5" },
      nextStep: "Open MAFY first — the RUTF stockout is the most time-sensitive issue.",
    },
  },
  {
    match: /summari[sz]e|portfolio|annual|overall/i,
    resp: {
      answer:
        "Across all 5 projects, Doctors for Madagascar reached approximately **47,860 beneficiaries** this quarter. MCHP and PROFESS are on track; MIRAY TB and TIA LONGO are stable with localised concerns; MAFY faces a supply-driven crisis in two southern districts.",
      metric: { label: "Total beneficiaries (Q4)", value: "47,860" },
      nextStep: "Open the Report Generator to assemble the annual portfolio report.",
    },
  },
  {
    match: /donor|report due|upcoming/i,
    resp: {
      answer:
        "Three donor reports are due in the next 8 weeks: **Global Fund (MIRAY TB)** on Jan 15, **ECHO (MAFY)** on Jan 22, and **BMZ (MCHP)** on Feb 10.",
      metric: { label: "Upcoming reports", value: "3" },
      nextStep: "Generate drafts for all three now and circulate for review.",
    },
  },
];

const FALLBACK_PORTFOLIO: CopilotResponse = {
  answer:
    "Portfolio is stable overall. MCHP and PROFESS are performing well; MIRAY TB and TIA LONGO have localised concerns; MAFY is in supply-driven crisis in two southern districts.",
  metric: { label: "Active projects", value: "5" },
  nextStep: "Ask about a specific project, or open Portfolio Overview for the full snapshot.",
};

const fallbackForProject = (p: Project): CopilotResponse => ({
  answer: `Here's the headline for **${p.name}**: ${p.oneLineChange}. Health score ${p.healthScore}/100.`,
  metric: { label: "Health score", value: `${p.healthScore} / 100` },
  nextStep: "Try one of the suggested prompts for a more specific answer.",
});

export async function askCopilot(
  prompt: string,
  opts: { projectId?: string } = {},
): Promise<CopilotResponse> {
  await new Promise((r) => setTimeout(r, 850));

  if (opts.projectId) {
    const project = getProject(opts.projectId);
    if (!project) return FALLBACK_PORTFOLIO;
    const matchers = [...(PROJECT_MATCHERS[opts.projectId] ?? []), ...GENERIC_MATCHERS];
    const hit = matchers.find((m) => m.match.test(prompt));
    const resp = hit ? hit.build(project) : fallbackForProject(project);
    const context = getContextForText(opts.projectId, prompt);
    return { ...resp, projectName: project.name, context: context ?? undefined };
  }

  // Portfolio scope.
  const portfolioHit = PORTFOLIO_RESPONSES.find((r) => r.match.test(prompt));
  if (portfolioHit) return portfolioHit.resp;

  // Try to find a project the prompt mentions.
  const referenced = PROJECTS.find((p) =>
    new RegExp(`\\b${p.name.replace(/\s+/g, "\\s+")}\\b`, "i").test(prompt),
  );
  if (referenced) return askCopilot(prompt, { projectId: referenced.id });

  return FALLBACK_PORTFOLIO;
}

export const PORTFOLIO_SUGGESTED_PROMPTS = [
  "Which projects need my attention today?",
  "Summarise the portfolio for the annual report.",
  "What donor reports are due soon?",
  "Where are the biggest data quality issues across projects?",
];
