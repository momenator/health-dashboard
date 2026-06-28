// Catalog of all Doctors for Madagascar projects with project-specific
// indicators, charts, data quality issues, and insights.
//
// In production this would be fetched from cloud storage; for the demo
// every project is treated as already loaded.

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Baby,
  Building2,
  CheckCircle2,
  GraduationCap,
  HeartPulse,
  Microscope,
  Package,
  Pill,
  Salad,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Users,
  Users2,
  Utensils,
} from "lucide-react";

export type StatusKind = "success" | "warning" | "danger";
export type Severity = "high" | "medium" | "low";

export type Kpi = {
  key: string;
  label: string;
  value: string;
  delta?: string;
  tone?: "success" | "warning" | "danger" | "default";
  icon?: LucideIcon;
};

export type StatusLightDef = {
  label: string;
  status: StatusKind;
  note: string;
};

export type WhatChanged = {
  direction: "up" | "down" | "flat" | "alert";
  text: string;
};

export type ProjectDataIssue = {
  id: string;
  severity: Severity;
  issue: string;
  location: string;
  district: string;
  indicator: string;
  type: "Outlier" | "Missing report" | "Missing field" | "Duplicate" | "Inconsistency" | "Impossible value";
  affected: number;
  action: string;
};

export type NextStep = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  owner: string;
  why: string;
};

export type SignatureChart =
  | {
      kind: "donut";
      title: string;
      data: { name: string; value: number; color: string }[];
    }
  | {
      kind: "funnel";
      title: string;
      steps: { name: string; value: number }[];
    }
  | {
      kind: "stacked";
      title: string;
      data: { label: string; a: number; b: number; aName: string; bName: string }[];
    };

export type Project = {
  id: string;
  name: string;
  fullName: string;
  focus: string;
  donor: string;
  region: "North" | "Highlands" | "East" | "South" | "Southwest";
  districts: string[];
  reportingPeriod: string;
  healthScore: number;
  status: StatusKind;
  needsAttention: boolean;
  oneLineChange: string;
  statusLights: StatusLightDef[];
  kpis: Kpi[];
  whatChanged: WhatChanged[];
  trend: { label: string; value: number }[];
  trendLabel: string;
  byDistrict: { district: string; value: number; target?: number }[];
  byDistrictLabel: string;
  completeness: { month: string; pct: number }[];
  signature: SignatureChart;
  dataIssues: ProjectDataIssue[];
  nextSteps: NextStep[];
  suggestedPrompts: string[];
  impactStory: string;
  vignette: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const trend = (vals: number[]) => MONTHS.map((m, i) => ({ label: m, value: vals[i] }));
const completeness = (vals: number[]) =>
  ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => ({ month: m, pct: vals[i] }));

// ---------- MIRAY TB ----------
const MIRAY_TB: Project = {
  id: "miray-tb",
  name: "MIRAY TB",
  fullName: "MIRAY — Tuberculosis Control Program",
  focus: "Tuberculosis case detection, treatment, and contact tracing",
  donor: "Global Fund",
  region: "North",
  districts: ["Ambanja", "Diego II", "Antsiranana", "Sambava", "Andapa", "Vohémar"],
  reportingPeriod: "Q4 2024 · Oct – Dec",
  healthScore: 68,
  status: "warning",
  needsAttention: true,
  oneLineChange: "Treatment success ↓ 8pp in Sambava",
  statusLights: [
    { label: "Case detection", status: "success", note: "Above quarterly target" },
    { label: "Treatment success", status: "danger", note: "Sambava dropped to 78%" },
    { label: "Drug stock", status: "warning", note: "Rifampicin <30 days in 2 sites" },
    { label: "Reporting", status: "success", note: "All 12 TB sites reporting" },
  ],
  kpis: [
    { key: "cases", label: "TB cases detected", value: "412", delta: "+6% vs Q3", tone: "success", icon: Microscope },
    { key: "success", label: "Treatment success rate", value: "84%", delta: "−4pp vs Q3", tone: "danger", icon: CheckCircle2 },
    { key: "contacts", label: "Contacts traced", value: "1,308", delta: "+11%", tone: "success", icon: Users },
    { key: "dots", label: "DOTS adherence", value: "91%", delta: "+1pp", icon: ShieldCheck },
    { key: "stock", label: "Days of rifampicin stock", value: "27", delta: "−18 vs Q3", tone: "danger", icon: Pill },
  ],
  whatChanged: [
    { direction: "down", text: "Treatment success rate fell 8 percentage points in Sambava district." },
    { direction: "up", text: "Contact tracing rose to 3.2 contacts per index case (target: 3)." },
    { direction: "alert", text: "Rifampicin stock below 30 days at Ambanja HC and Diego II Clinic." },
    { direction: "up", text: "Sputum smear positivity climbed 4pp — possible outbreak signal in Diego II." },
  ],
  trend: trend([62, 64, 68, 72, 75, 78, 80, 82, 84, 86, 85, 84]),
  trendLabel: "Treatment success rate (%)",
  byDistrict: [
    { district: "Ambanja", value: 86, target: 85 },
    { district: "Diego II", value: 82, target: 85 },
    { district: "Antsiranana", value: 89, target: 85 },
    { district: "Sambava", value: 78, target: 85 },
    { district: "Andapa", value: 88, target: 85 },
    { district: "Vohémar", value: 84, target: 85 },
  ],
  byDistrictLabel: "Treatment success rate by district (%)",
  completeness: completeness([95, 96, 94, 92, 93, 95]),
  signature: {
    kind: "donut",
    title: "Treatment outcomes (cohort 412)",
    data: [
      { name: "Cured", value: 286, color: "var(--color-success)" },
      { name: "Completed", value: 60, color: "var(--color-primary)" },
      { name: "Lost to follow-up", value: 38, color: "var(--color-warning)" },
      { name: "Failed", value: 18, color: "var(--color-danger)" },
      { name: "Died", value: 10, color: "var(--color-muted-foreground)" },
    ],
  },
  dataIssues: [
    {
      id: "tb-1",
      severity: "high",
      issue: "Treatment success reported as 102% in Ambanja HC.",
      location: "Ambanja HC",
      district: "Ambanja",
      indicator: "treatment_success_rate",
      type: "Impossible value",
      affected: 1,
      action: "Verify cohort denominator with the TB register.",
    },
    {
      id: "tb-2",
      severity: "high",
      issue: "Sambava DOT site missing November contact tracing log.",
      location: "Sambava DOT",
      district: "Sambava",
      indicator: "contacts_traced",
      type: "Missing report",
      affected: 1,
      action: "Request retroactive contact list from facility supervisor.",
    },
    {
      id: "tb-3",
      severity: "medium",
      issue: "12 patient records missing HIV co-infection status.",
      location: "Multiple",
      district: "Diego II",
      indicator: "hiv_status",
      type: "Missing field",
      affected: 12,
      action: "Backfill from paper registers during next supervision visit.",
    },
  ],
  nextSteps: [
    {
      id: "tb-s1",
      priority: "high",
      title: "Investigate treatment success drop in Sambava",
      owner: "TB Program Lead",
      why: "Loss-to-follow-up appears to be driving the decline; needs root-cause review.",
    },
    {
      id: "tb-s2",
      priority: "high",
      title: "Emergency rifampicin transfer to Ambanja and Diego II",
      owner: "Supply Chain Lead",
      why: "Stockouts in <30 days would interrupt active treatment for 110+ patients.",
    },
    {
      id: "tb-s3",
      priority: "medium",
      title: "Field visit to validate cohort numbers in Ambanja",
      owner: "M&E Officer",
      why: "Resolve the impossible 102% treatment success rate before donor reporting.",
    },
  ],
  suggestedPrompts: [
    "Why did treatment success drop in Sambava?",
    "Which TB sites are running low on rifampicin?",
    "How does contact tracing compare to last quarter?",
    "Summarise MIRAY TB for the Global Fund.",
  ],
  impactStory:
    "MIRAY TB detected 412 new tuberculosis cases this quarter — a 6% increase over Q3 — and traced 1,308 close contacts across six northern districts. While treatment success remains strong at 84%, a localised drop in Sambava is prompting an active root-cause investigation.",
  vignette:
    "In Diego II, a 34-year-old mother of three completed her six-month treatment in December and returned to work as a market vendor. Her three children were screened during contact tracing and started preventive therapy.",
};

// ---------- MCHP ----------
const MCHP: Project = {
  id: "mchp",
  name: "MCHP",
  fullName: "Maternal & Child Health Program",
  focus: "Antenatal care, skilled birth attendance, child immunization",
  donor: "BMZ · German Federal Ministry",
  region: "Highlands",
  districts: ["Antananarivo-Avaradrano", "Manjakandriana", "Anjozorobe", "Ankazobe", "Andramasina"],
  reportingPeriod: "Q4 2024 · Oct – Dec",
  healthScore: 81,
  status: "success",
  needsAttention: false,
  oneLineChange: "ANC4+ coverage ↑ 12% vs last month",
  statusLights: [
    { label: "Antenatal coverage", status: "success", note: "ANC4+ at 74% (target 70%)" },
    { label: "Skilled birth attendance", status: "success", note: "Above target in 4/5 districts" },
    { label: "Child immunization", status: "warning", note: "DTP3 lagging in Ankazobe" },
    { label: "Reporting", status: "warning", note: "1 facility missing 2 months" },
  ],
  kpis: [
    { key: "anc", label: "ANC4+ visits", value: "2,184", delta: "+12% vs last month", tone: "success", icon: HeartPulse },
    { key: "sba", label: "Skilled birth attendance", value: "78%", delta: "+3pp", tone: "success", icon: Baby },
    { key: "vacc", label: "Child vaccinations", value: "3,216", delta: "+5%", tone: "success", icon: Syringe },
    { key: "pnc", label: "Postnatal visits (PNC2+)", value: "1,402", delta: "+8%", icon: Stethoscope },
    { key: "u5", label: "Under-5 consultations", value: "4,810", delta: "−2%", tone: "default", icon: Baby },
  ],
  whatChanged: [
    { direction: "up", text: "ANC4+ visits up 12% — strongest improvement in Manjakandriana." },
    { direction: "up", text: "Skilled birth attendance crossed the 75% target for the first time." },
    { direction: "down", text: "DTP3 coverage in Ankazobe slipped to 69% — below 75% target." },
    { direction: "alert", text: "Anjozorobe rural post: no reporting for Nov and Dec." },
  ],
  trend: trend([1620, 1680, 1710, 1740, 1790, 1850, 1880, 1910, 1950, 2010, 2080, 2184]),
  trendLabel: "Monthly ANC4+ visits",
  byDistrict: [
    { district: "Avaradrano", value: 82, target: 75 },
    { district: "Manjakandriana", value: 88, target: 75 },
    { district: "Anjozorobe", value: 71, target: 75 },
    { district: "Ankazobe", value: 69, target: 75 },
    { district: "Andramasina", value: 79, target: 75 },
  ],
  byDistrictLabel: "DTP3 vaccination coverage by district (%)",
  completeness: completeness([92, 93, 91, 88, 84, 82]),
  signature: {
    kind: "funnel",
    title: "Antenatal care continuum (this quarter)",
    steps: [
      { name: "ANC1", value: 3120 },
      { name: "ANC2", value: 2780 },
      { name: "ANC3", value: 2430 },
      { name: "ANC4+", value: 2184 },
      { name: "Skilled birth", value: 1704 },
    ],
  },
  dataIssues: [
    {
      id: "mchp-1",
      severity: "high",
      issue: "Anjozorobe rural post: no reports for Nov and Dec.",
      location: "Anjozorobe Rural",
      district: "Anjozorobe",
      indicator: "reporting_month",
      type: "Missing report",
      affected: 2,
      action: "Field visit + retroactive submission from paper registers.",
    },
    {
      id: "mchp-2",
      severity: "medium",
      issue: "DTP3 coverage exceeds population estimate in Manjakandriana.",
      location: "Manjakandriana HC",
      district: "Manjakandriana",
      indicator: "child_vaccinations",
      type: "Outlier",
      affected: 1,
      action: "Re-verify catchment population denominator.",
    },
    {
      id: "mchp-3",
      severity: "low",
      issue: "Inconsistent spelling of facility name (Andramasina / Andramasina HC).",
      location: "Andramasina",
      district: "Andramasina",
      indicator: "facility_name",
      type: "Inconsistency",
      affected: 6,
      action: "Standardize via schema mapping.",
    },
  ],
  nextSteps: [
    {
      id: "mchp-s1",
      priority: "high",
      title: "Re-establish reporting from Anjozorobe Rural",
      owner: "M&E Officer",
      why: "Two months of missing data limits visibility into ~5,000 catchment population.",
    },
    {
      id: "mchp-s2",
      priority: "medium",
      title: "Outreach push for DTP3 in Ankazobe",
      owner: "Program Manager",
      why: "District is 6pp below target; mobile clinic schedule needs adjustment.",
    },
  ],
  suggestedPrompts: [
    "Which districts are below the DTP3 target?",
    "How has ANC4+ coverage trended over the year?",
    "Why is Anjozorobe not reporting?",
    "Summarise MCHP for the BMZ donor report.",
  ],
  impactStory:
    "Across the highlands, MCHP supported 2,184 fourth-visit antenatal consultations and 3,216 child vaccinations this quarter. Skilled birth attendance crossed the 75% target for the first time, while a targeted response is underway in Ankazobe to recover DTP3 coverage.",
  vignette:
    "In Manjakandriana, a 22-year-old first-time mother completed all four antenatal visits and delivered safely with a trained midwife. Her newborn received BCG and OPV0 within the recommended 24-hour window.",
};

// ---------- MAFY ----------
const MAFY: Project = {
  id: "mafy",
  name: "MAFY",
  fullName: "MAFY — Acute Malnutrition Response",
  focus: "Screening, admission, and treatment of acute malnutrition in under-5s",
  donor: "ECHO · EU Humanitarian Aid",
  region: "South",
  districts: ["Amboasary", "Ambovombe", "Tsihombe", "Bekily", "Beloha"],
  reportingPeriod: "Q4 2024 · Oct – Dec",
  healthScore: 62,
  status: "danger",
  needsAttention: true,
  oneLineChange: "RUTF stockout in 2 districts — admissions ↓",
  statusLights: [
    { label: "Screening coverage", status: "success", note: "12,800 MUAC screenings done" },
    { label: "SAM admissions", status: "warning", note: "Below capacity in stockout zones" },
    { label: "Cure rate", status: "warning", note: "78% — Sphere min. 75%" },
    { label: "RUTF supply", status: "danger", note: "Stockout in Tsihombe & Beloha" },
  ],
  kpis: [
    { key: "muac", label: "MUAC screenings", value: "12,840", delta: "+9% vs Q3", tone: "success", icon: Salad },
    { key: "sam", label: "SAM admissions", value: "486", delta: "−14% (stockout-driven)", tone: "danger", icon: Activity },
    { key: "mam", label: "MAM admissions", value: "1,212", delta: "+4%", icon: Utensils },
    { key: "cure", label: "Cure rate", value: "78%", delta: "−3pp", tone: "warning", icon: CheckCircle2 },
    { key: "rutf", label: "RUTF days of stock", value: "11", delta: "−21 vs Q3", tone: "danger", icon: Package },
  ],
  whatChanged: [
    { direction: "alert", text: "RUTF stockout in Tsihombe and Beloha since mid-November." },
    { direction: "down", text: "SAM admissions fell 14% — strongly correlated with stockout zones." },
    { direction: "up", text: "Active MUAC screening at community level expanded by 9%." },
    { direction: "down", text: "Cure rate dipped to 78%, near the Sphere minimum standard." },
  ],
  trend: trend([320, 360, 410, 460, 520, 580, 620, 640, 610, 590, 540, 486]),
  trendLabel: "Monthly SAM admissions",
  byDistrict: [
    { district: "Amboasary", value: 84, target: 75 },
    { district: "Ambovombe", value: 81, target: 75 },
    { district: "Tsihombe", value: 70, target: 75 },
    { district: "Bekily", value: 79, target: 75 },
    { district: "Beloha", value: 68, target: 75 },
  ],
  byDistrictLabel: "Cure rate by district (%)",
  completeness: completeness([86, 88, 84, 82, 78, 74]),
  signature: {
    kind: "stacked",
    title: "Admissions vs RUTF supply by district",
    data: [
      { label: "Amboasary", a: 118, b: 42, aName: "SAM admissions", bName: "Days RUTF stock" },
      { label: "Ambovombe", a: 142, b: 36, aName: "SAM admissions", bName: "Days RUTF stock" },
      { label: "Tsihombe", a: 78, b: 0, aName: "SAM admissions", bName: "Days RUTF stock" },
      { label: "Bekily", a: 96, b: 28, aName: "SAM admissions", bName: "Days RUTF stock" },
      { label: "Beloha", a: 52, b: 0, aName: "SAM admissions", bName: "Days RUTF stock" },
    ],
  },
  dataIssues: [
    {
      id: "mafy-1",
      severity: "high",
      issue: "Zero SAM admissions reported in Beloha for 3 weeks despite active outbreak alerts.",
      location: "Beloha HC",
      district: "Beloha",
      indicator: "sam_admissions",
      type: "Outlier",
      affected: 1,
      action: "Likely caused by RUTF stockout, not absence of cases — verify with field team.",
    },
    {
      id: "mafy-2",
      severity: "high",
      issue: "MUAC screenings reported as 0 for week 47 in Tsihombe.",
      location: "Tsihombe Outreach",
      district: "Tsihombe",
      indicator: "muac_screenings",
      type: "Missing field",
      affected: 1,
      action: "Re-enter from outreach team paper forms.",
    },
    {
      id: "mafy-3",
      severity: "medium",
      issue: "Cure rate reported as 110% in Amboasary.",
      location: "Amboasary HC",
      district: "Amboasary",
      indicator: "cure_rate",
      type: "Impossible value",
      affected: 1,
      action: "Cohort denominator likely wrong — recheck admissions cohort.",
    },
  ],
  nextSteps: [
    {
      id: "mafy-s1",
      priority: "high",
      title: "Emergency RUTF resupply to Tsihombe and Beloha",
      owner: "Supply Chain Lead",
      why: "Two districts have been without therapeutic food for 4+ weeks during peak lean season.",
    },
    {
      id: "mafy-s2",
      priority: "high",
      title: "Brief ECHO on RUTF pipeline risk",
      owner: "Country Director",
      why: "Donor needs visibility before the next quarterly review.",
    },
  ],
  suggestedPrompts: [
    "Where are we running out of RUTF?",
    "Why did SAM admissions drop?",
    "Compare cure rates across MAFY districts.",
    "Draft an ECHO update on RUTF pipeline risk.",
  ],
  impactStory:
    "MAFY screened over 12,800 children for acute malnutrition this quarter and treated 486 children for severe acute malnutrition. Persistent RUTF stockouts in two southern districts have constrained admissions and prompted an emergency resupply request.",
  vignette:
    "In Amboasary, an 11-month-old boy admitted at 9.8 cm MUAC was discharged cured eight weeks later at a healthy weight, thanks to community-based outpatient therapeutic care.",
};

// ---------- TIA LONGO ----------
const TIA_LONGO: Project = {
  id: "tia-longo",
  name: "TIA LONGO",
  fullName: "TIA LONGO — Primary Care & Outreach",
  focus: "Primary care consultations, mobile outreach, referrals",
  donor: "Doctors for Madagascar core funding",
  region: "East",
  districts: ["Vatomandry", "Mahanoro", "Marolambo", "Brickaville", "Toamasina II"],
  reportingPeriod: "Q4 2024 · Oct – Dec",
  healthScore: 74,
  status: "warning",
  needsAttention: true,
  oneLineChange: "Outreach sessions ↓ 22% — fuel shortage Aug–Sep",
  statusLights: [
    { label: "Outpatient visits", status: "success", note: "Above target in 4/5 districts" },
    { label: "Mobile outreach", status: "danger", note: "Sessions down 22% vs Q3" },
    { label: "Referrals", status: "success", note: "Referral completion at 71%" },
    { label: "Reporting", status: "success", note: "All 14 sites reporting" },
  ],
  kpis: [
    { key: "opd", label: "Outpatient visits", value: "18,420", delta: "+4%", tone: "success", icon: Stethoscope },
    { key: "outreach", label: "Outreach sessions", value: "84", delta: "−22% vs Q3", tone: "danger", icon: Activity },
    { key: "ref", label: "Referrals issued", value: "612", delta: "+9%", icon: Building2 },
    { key: "refcomp", label: "Referral completion", value: "71%", delta: "+4pp", tone: "success", icon: CheckCircle2 },
    { key: "distance", label: "Avg. distance to facility", value: "9.4 km", delta: "−0.6 km", tone: "success", icon: Users },
  ],
  whatChanged: [
    { direction: "down", text: "Outreach sessions fell 22% during the August–September fuel shortage." },
    { direction: "up", text: "Outpatient visits recovered in October as outreach restarted." },
    { direction: "up", text: "Referral completion improved 4pp after SMS reminder pilot." },
    { direction: "flat", text: "All 14 facilities reported on time this quarter." },
  ],
  trend: trend([1380, 1420, 1490, 1510, 1560, 1620, 1410, 1240, 1380, 1540, 1640, 1610]),
  trendLabel: "Monthly outpatient visits",
  byDistrict: [
    { district: "Vatomandry", value: 3820, target: 3500 },
    { district: "Mahanoro", value: 4120, target: 3500 },
    { district: "Marolambo", value: 2640, target: 3500 },
    { district: "Brickaville", value: 3980, target: 3500 },
    { district: "Toamasina II", value: 3860, target: 3500 },
  ],
  byDistrictLabel: "Outpatient visits by district",
  completeness: completeness([94, 95, 96, 95, 96, 97]),
  signature: {
    kind: "donut",
    title: "Top reasons for consultation",
    data: [
      { name: "Respiratory infections", value: 5120, color: "var(--color-primary)" },
      { name: "Malaria", value: 3940, color: "var(--color-warning)" },
      { name: "Diarrheal disease", value: 2860, color: "var(--color-chart-2)" },
      { name: "Maternal/child", value: 3210, color: "var(--color-chart-5)" },
      { name: "Other", value: 3290, color: "var(--color-muted-foreground)" },
    ],
  },
  dataIssues: [
    {
      id: "tl-1",
      severity: "medium",
      issue: "Marolambo outreach team logged 0 sessions for 3 weeks of August.",
      location: "Marolambo Outreach",
      district: "Marolambo",
      indicator: "outreach_sessions",
      type: "Missing report",
      affected: 3,
      action: "Likely fuel shortage; confirm with logistics and annotate.",
    },
    {
      id: "tl-2",
      severity: "low",
      issue: "Duplicate referral entries for week 44 in Brickaville.",
      location: "Brickaville HC",
      district: "Brickaville",
      indicator: "referrals",
      type: "Duplicate",
      affected: 8,
      action: "Deduplicate and keep latest submission.",
    },
  ],
  nextSteps: [
    {
      id: "tl-s1",
      priority: "medium",
      title: "Pre-position fuel reserves for cyclone season",
      owner: "Logistics Coordinator",
      why: "August–September fuel shortage cost the project 22% of outreach capacity.",
    },
    {
      id: "tl-s2",
      priority: "low",
      title: "Scale SMS referral reminders to all 14 sites",
      owner: "Program Manager",
      why: "Pilot improved referral completion by 4 percentage points.",
    },
  ],
  suggestedPrompts: [
    "Why did outreach sessions drop in August?",
    "Which district has the lowest referral completion?",
    "What is the top reason for consultations?",
    "Summarise TIA LONGO for the internal quarterly review.",
  ],
  impactStory:
    "TIA LONGO delivered 18,420 primary care consultations across the east coast this quarter and held 84 mobile outreach sessions despite a fuel supply disruption in August and September. Referral completion improved to 71% after a successful SMS reminder pilot.",
  vignette:
    "A mobile clinic stop in Marolambo reached 142 children in a single day, identifying eight cases of severe malaria that were immediately referred to the district hospital.",
};

// ---------- PROFESS ----------
const PROFESS: Project = {
  id: "profess",
  name: "PROFESS",
  fullName: "PROFESS — Health Worker Training & Supervision",
  focus: "Community health worker training, supervision, retention",
  donor: "Else Kröner-Fresenius Foundation",
  region: "Southwest",
  districts: ["Toliara II", "Betioky-Sud", "Ampanihy-Ouest", "Ankazoabo-Sud"],
  reportingPeriod: "Q4 2024 · Oct – Dec",
  healthScore: 79,
  status: "success",
  needsAttention: false,
  oneLineChange: "Knowledge test pass rate ↑ 9pp",
  statusLights: [
    { label: "CHWs trained", status: "success", note: "118 of 120 target reached" },
    { label: "Supervision", status: "success", note: "92% sites visited this quarter" },
    { label: "Knowledge tests", status: "success", note: "Pass rate 86% (+9pp)" },
    { label: "Retention", status: "warning", note: "Ampanihy retention at 81%" },
  ],
  kpis: [
    { key: "chw", label: "CHWs trained", value: "118", delta: "+18 vs Q3", tone: "success", icon: GraduationCap },
    { key: "sup", label: "Supervision visits", value: "94", delta: "+12%", tone: "success", icon: ShieldCheck },
    { key: "pass", label: "Knowledge test pass rate", value: "86%", delta: "+9pp", tone: "success", icon: CheckCircle2 },
    { key: "kits", label: "CHW kits distributed", value: "120", delta: "On target", icon: Package },
    { key: "ret", label: "12-month retention", value: "88%", delta: "−2pp", tone: "warning", icon: Users2 },
  ],
  whatChanged: [
    { direction: "up", text: "Knowledge test pass rate climbed 9pp after refreshed curriculum rollout." },
    { direction: "up", text: "118 of 120 targeted CHWs completed full training." },
    { direction: "down", text: "Retention in Ampanihy dropped to 81% — exit interviews underway." },
    { direction: "flat", text: "All 120 CHW kits distributed on schedule." },
  ],
  trend: trend([64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86]),
  trendLabel: "Knowledge test pass rate (%)",
  byDistrict: [
    { district: "Toliara II", value: 90, target: 80 },
    { district: "Betioky-Sud", value: 88, target: 80 },
    { district: "Ampanihy-Ouest", value: 81, target: 80 },
    { district: "Ankazoabo-Sud", value: 86, target: 80 },
  ],
  byDistrictLabel: "12-month CHW retention by district (%)",
  completeness: completeness([91, 93, 94, 95, 96, 96]),
  signature: {
    kind: "stacked",
    title: "Trainees by cohort",
    data: [
      { label: "Toliara II", a: 32, b: 30, aName: "Enrolled", bName: "Certified" },
      { label: "Betioky-Sud", a: 28, b: 27, aName: "Enrolled", bName: "Certified" },
      { label: "Ampanihy", a: 30, b: 27, aName: "Enrolled", bName: "Certified" },
      { label: "Ankazoabo-Sud", a: 30, b: 28, aName: "Enrolled", bName: "Certified" },
    ],
  },
  dataIssues: [
    {
      id: "pf-1",
      severity: "medium",
      issue: "Supervision visit log missing for 4 CHWs in Ampanihy.",
      location: "Ampanihy",
      district: "Ampanihy-Ouest",
      indicator: "supervision_visit",
      type: "Missing field",
      affected: 4,
      action: "Backfill from supervisor checklists.",
    },
    {
      id: "pf-2",
      severity: "low",
      issue: "Two CHW IDs recorded with inconsistent formatting.",
      location: "Multiple",
      district: "Toliara II",
      indicator: "chw_id",
      type: "Inconsistency",
      affected: 2,
      action: "Apply standard CHW-XXXX format.",
    },
  ],
  nextSteps: [
    {
      id: "pf-s1",
      priority: "medium",
      title: "Conduct retention exit interviews in Ampanihy",
      owner: "Training Lead",
      why: "Retention dropped 7pp; understanding the cause now prevents larger attrition.",
    },
    {
      id: "pf-s2",
      priority: "low",
      title: "Replicate refreshed curriculum in Q1 2025 cohort",
      owner: "Training Lead",
      why: "Pass-rate gains warrant scaling to the next cohort.",
    },
  ],
  suggestedPrompts: [
    "How is CHW retention trending?",
    "Which district has the highest knowledge test pass rate?",
    "Why are we losing CHWs in Ampanihy?",
    "Summarise PROFESS for the Else Kröner-Fresenius Foundation.",
  ],
  impactStory:
    "PROFESS trained and certified 118 community health workers across four southwestern districts and conducted 94 supervision visits this quarter. The refreshed curriculum lifted knowledge test pass rates by nine percentage points.",
  vignette:
    "A newly certified CHW in Betioky-Sud screened 87 households for malnutrition in her first month of practice, referring six children to the nearest health centre for treatment.",
};

export const PROJECTS: Project[] = [MIRAY_TB, MCHP, MAFY, TIA_LONGO, PROFESS];

export const getProject = (id: string) => PROJECTS.find((p) => p.id === id);

export const PORTFOLIO_KPIS = [
  { key: "beneficiaries", label: "Total beneficiaries reached", value: "47,860", delta: "+8% vs Q3" },
  { key: "projects", label: "Active projects", value: "5", delta: "All reporting" },
  { key: "facilities", label: "Facilities reporting", value: "62 / 65", delta: "3 facilities silent" },
  { key: "issues", label: "Open data quality issues", value: "13", delta: "4 high severity" },
  { key: "reports", label: "Upcoming donor reports", value: "3", delta: "Next due in 12 days" },
];

export const UPCOMING_REPORTS = [
  { project: "MIRAY TB", type: "Global Fund quarterly", due: "Jan 15, 2025", projectId: "miray-tb" },
  { project: "MAFY", type: "ECHO interim report", due: "Jan 22, 2025", projectId: "mafy" },
  { project: "MCHP", type: "BMZ annual report", due: "Feb 10, 2025", projectId: "mchp" },
];
