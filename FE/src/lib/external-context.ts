// Hardcoded external events used by the copilot to suggest possible
// explanations for changes in the data. Always presented as "possible
// explanation", never as confirmed cause.

export type ExternalEvent = {
  id: string;
  date: string; // ISO yyyy-mm
  type: "cyclone" | "outbreak" | "political" | "holiday" | "logistics" | "climate";
  title: string;
  regions: ("North" | "Highlands" | "East" | "South" | "Southwest" | "National")[];
  description: string;
};

export const EXTERNAL_EVENTS: ExternalEvent[] = [
  {
    id: "gamane",
    date: "2024-03",
    type: "cyclone",
    title: "Cyclone Gamane",
    regions: ["North", "East"],
    description:
      "Category 1 cyclone crossed the SAVA region in late March 2024, disrupting transport and flooding several health facilities for 1–2 weeks.",
  },
  {
    id: "measles-q2",
    date: "2024-05",
    type: "outbreak",
    title: "Localised measles outbreak",
    regions: ["North"],
    description:
      "Measles cases rose sharply in northern districts during April–May 2024, prompting reactive vaccination campaigns and pulling staff time away from routine reporting.",
  },
  {
    id: "fuel-shortage",
    date: "2024-08",
    type: "logistics",
    title: "National fuel shortage",
    regions: ["National"],
    description:
      "Diesel and petrol shortages from late July through September 2024 reduced mobile outreach capacity nationwide.",
  },
  {
    id: "drought-south",
    date: "2024-10",
    type: "climate",
    title: "Prolonged dry season in the south",
    regions: ["South", "Southwest"],
    description:
      "Below-average rainfall extended the lean season in the deep south, increasing acute malnutrition admissions and pressure on therapeutic food supply.",
  },
  {
    id: "easter",
    date: "2024-04",
    type: "holiday",
    title: "Easter week",
    regions: ["National"],
    description:
      "Public holidays around Easter reduce facility opening hours and outpatient throughput for that reporting week.",
  },
  {
    id: "elections",
    date: "2024-11",
    type: "political",
    title: "Communal elections",
    regions: ["National"],
    description:
      "Communal elections in late November 2024 affected staff availability and reporting timelines, particularly at the district level.",
  },
  {
    id: "tb-day",
    date: "2024-03",
    type: "political",
    title: "World TB Day campaign",
    regions: ["National"],
    description:
      "National TB Day activities in March drove a temporary spike in case detection through mass screening events.",
  },
];

const REGION_OF: Record<string, ExternalEvent["regions"][number]> = {
  "miray-tb": "North",
  mchp: "Highlands",
  mafy: "South",
  "tia-longo": "East",
  profess: "Southwest",
};

export function getContextForProject(projectId: string): ExternalEvent[] {
  const region = REGION_OF[projectId];
  if (!region) return [];
  return EXTERNAL_EVENTS.filter(
    (e) => e.regions.includes(region) || e.regions.includes("National"),
  );
}

export function getContextForText(projectId: string, text: string): ExternalEvent | null {
  const candidates = getContextForProject(projectId);
  const lower = text.toLowerCase();
  // Heuristic keyword matching for the mocked AI.
  if (/(cyclone|storm|flood|sambava|sava)/.test(lower)) {
    return candidates.find((e) => e.id === "gamane") ?? null;
  }
  if (/(outbreak|measles|spike|surge)/.test(lower)) {
    return candidates.find((e) => e.id === "measles-q2") ?? null;
  }
  if (/(fuel|outreach|aug|sept|transport)/.test(lower)) {
    return candidates.find((e) => e.id === "fuel-shortage") ?? null;
  }
  if (/(drought|lean season|malnutrition|rutf|south)/.test(lower)) {
    return candidates.find((e) => e.id === "drought-south") ?? null;
  }
  if (/(elect|november|nov\b)/.test(lower)) {
    return candidates.find((e) => e.id === "elections") ?? null;
  }
  if (/(holiday|easter|april|apr\b)/.test(lower)) {
    return candidates.find((e) => e.id === "easter") ?? null;
  }
  if (/(tb day|case detection|screening campaign)/.test(lower)) {
    return candidates.find((e) => e.id === "tb-day") ?? null;
  }
  return null;
}
