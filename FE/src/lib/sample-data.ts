// Realistic placeholder M&E data for Doctors for Madagascar demo.

export const DISTRICTS = [
  "Ambanja",
  "Diego II",
  "Antsiranana",
  "Sambava",
  "Andapa",
  "Vohémar",
] as const;

export const FACILITIES = [
  { name: "Ambanja Health Center", district: "Ambanja" },
  { name: "Facility B", district: "Ambanja" },
  { name: "Diego II Clinic", district: "Diego II" },
  { name: "Diego II Rural Post", district: "Diego II" },
  { name: "Antsiranana Hospital", district: "Antsiranana" },
  { name: "Sambava Maternity", district: "Sambava" },
  { name: "Andapa Outreach", district: "Andapa" },
  { name: "Vohémar Health Post", district: "Vohémar" },
];

export const MONTHLY_OUTPATIENT = [
  { month: "Jan", visits: 920 },
  { month: "Feb", visits: 985 },
  { month: "Mar", visits: 1040 },
  { month: "Apr", visits: 1110 },
  { month: "May", visits: 1180 },
  { month: "Jun", visits: 1090 },
  { month: "Jul", visits: 1205 },
  { month: "Aug", visits: 1260 },
  { month: "Sep", visits: 1190 },
  { month: "Oct", visits: 1245 },
  { month: "Nov", visits: 1310 },
  { month: "Dec", visits: 1240 },
];

export const VACCINATION_BY_DISTRICT = [
  { district: "Ambanja", coverage: 68 },
  { district: "Diego II", coverage: 71 },
  { district: "Antsiranana", coverage: 89 },
  { district: "Sambava", coverage: 84 },
  { district: "Andapa", coverage: 92 },
  { district: "Vohémar", coverage: 78 },
];

export const STOCKOUT_BY_FACILITY = [
  { facility: "Ambanja HC", days: 11 },
  { facility: "Facility B", days: 14 },
  { facility: "Diego II Clinic", days: 9 },
  { facility: "Diego II Rural", days: 7 },
  { facility: "Antsiranana", days: 2 },
  { facility: "Sambava", days: 4 },
  { facility: "Andapa", days: 1 },
  { facility: "Vohémar", days: 5 },
];

export const REPORTING_COMPLETENESS = [
  { month: "Jul", pct: 88 },
  { month: "Aug", pct: 92 },
  { month: "Sep", pct: 90 },
  { month: "Oct", pct: 85 },
  { month: "Nov", pct: 78 },
  { month: "Dec", pct: 72 },
];

export const KPIS = {
  patientsReached: 12438,
  childVaccinations: 3216,
  maternalVisits: 1842,
  facilitiesReporting: "16 / 18",
  stockoutAlerts: 7,
};

export const HEALTH_SCORE = 74;

export const TRAFFIC_LIGHTS = [
  { label: "Data Quality", status: "warning" as const, note: "15 records flagged" },
  { label: "KPI Performance", status: "success" as const, note: "Above targets" },
  { label: "Reporting Consistency", status: "danger" as const, note: "2 facilities missing" },
  { label: "Service Coverage", status: "warning" as const, note: "2 districts below 75%" },
];

export const TOP_INSIGHTS = [
  "Vaccination coverage declined by 12% in two northern districts.",
  "Three facilities reported medicine stockouts for more than 7 days.",
  "One district has missing reports for the last two reporting periods.",
  "Maternal health visits increased by 18% compared to the previous month.",
];

export type Severity = "high" | "medium" | "low";
export type DataIssue = {
  id: string;
  severity: Severity;
  issue: string;
  location: string;
  district: string;
  indicator: string;
  type: string;
  affected: number;
  action: string;
};

export const DATA_ISSUES: DataIssue[] = [
  {
    id: "i1",
    severity: "high",
    issue: "Vaccination coverage exceeds 100% in Ambanja District.",
    location: "Ambanja HC",
    district: "Ambanja",
    indicator: "child_vaccinations",
    type: "Outlier",
    affected: 1,
    action: "Verify denominator population and recount vaccination records.",
  },
  {
    id: "i2",
    severity: "high",
    issue: "No report submitted by Facility B for two months.",
    location: "Facility B",
    district: "Ambanja",
    indicator: "reporting_month",
    type: "Missing report",
    affected: 2,
    action: "Contact facility coordinator and request retroactive submission.",
  },
  {
    id: "i3",
    severity: "medium",
    issue: "15 records missing patient age group.",
    location: "Multiple",
    district: "Diego II",
    indicator: "patients_under_5",
    type: "Missing field",
    affected: 15,
    action: "Re-enter age group from paper registers.",
  },
  {
    id: "i4",
    severity: "medium",
    issue: "Duplicate facility report detected for March.",
    location: "Sambava Maternity",
    district: "Sambava",
    indicator: "maternal_health_visits",
    type: "Duplicate",
    affected: 1,
    action: "Remove duplicate entry; keep the latest submission.",
  },
  {
    id: "i5",
    severity: "low",
    issue: "Inconsistent spelling of facility name.",
    location: "Diego II Clinic / Diego 2 Clinic",
    district: "Diego II",
    indicator: "facility_name",
    type: "Inconsistency",
    affected: 4,
    action: "Standardize naming via schema mapping.",
  },
];

export type Priority = "high" | "medium" | "low";
export type ActionStatus = "New" | "In progress" | "Resolved";
export type ActionItem = {
  id: string;
  priority: Priority;
  issue: string;
  why: string;
  action: string;
  owner: string;
  status: ActionStatus;
};

export const ACTION_ITEMS: ActionItem[] = [
  {
    id: "a1",
    priority: "high",
    issue: "Facilities stopped reporting",
    why: "Data gaps reduce visibility into service delivery and donor confidence.",
    action: "Follow up with facilities that stopped reporting.",
    owner: "M&E Officer",
    status: "New",
  },
  {
    id: "a2",
    priority: "high",
    issue: "Vaccine stockouts in northern districts",
    why: "Stockouts directly block children from receiving essential vaccinations.",
    action: "Investigate vaccine stockouts in northern districts.",
    owner: "Supply Chain Lead",
    status: "In progress",
  },
  {
    id: "a3",
    priority: "medium",
    issue: "Duplicate March reports",
    why: "Duplicates inflate KPIs and distort donor reporting.",
    action: "Clean duplicate March reports.",
    owner: "Data Manager",
    status: "New",
  },
  {
    id: "a4",
    priority: "medium",
    issue: "Low-coverage outreach areas",
    why: "Two districts are below the 75% vaccination coverage target.",
    action: "Review outreach schedule in low-coverage areas.",
    owner: "Program Manager",
    status: "New",
  },
  {
    id: "a5",
    priority: "low",
    issue: "Facility naming inconsistencies",
    why: "Inconsistent naming complicates aggregation and trend analysis.",
    action: "Standardize facility naming.",
    owner: "Data Manager",
    status: "Resolved",
  },
];

export const SCHEMA_MAPPING = [
  { uploaded: "facility_name", standard: "Facility" },
  { uploaded: "district", standard: "District" },
  { uploaded: "reporting_month", standard: "Reporting Period" },
  { uploaded: "child_vaccinations", standard: "Child Vaccinations" },
  { uploaded: "stockout_days", standard: "Stockout Days" },
  { uploaded: "maternal_health_visits", standard: "Maternal Health Visits" },
  { uploaded: "outpatient_visits", standard: "Outpatient Visits" },
  { uploaded: "antenatal_care_visits", standard: "Antenatal Care Visits" },
  { uploaded: "patients_under_5", standard: "Patients Under 5" },
  { uploaded: "referrals", standard: "Referrals" },
];

export const STANDARD_INDICATORS = [
  "Facility",
  "District",
  "Reporting Period",
  "Child Vaccinations",
  "Stockout Days",
  "Maternal Health Visits",
  "Outpatient Visits",
  "Antenatal Care Visits",
  "Patients Under 5",
  "Referrals",
  "(unmapped)",
];
