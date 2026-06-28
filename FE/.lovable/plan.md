
# M&E Copilot — Multi-Project Restructure

## Goals

Move from a single-dataset prototype to a project-manager workspace covering all 5 Doctors for Madagascar projects. Keep AI mocked and external context hardcoded for a reliable demo.

## New Information Architecture

```
/                        Landing (marketing)
/portfolio               Portfolio Overview (new home of the app)
/projects/$projectId     Project Dashboard
/projects/$projectId/data-quality
/projects/$projectId/ask
/projects/$projectId/report
/data-quality            Cross-project data quality (portfolio-level)
/ask                     Cross-project Ask Your Data
/report                  Cross-project / annual report generator
/settings                Schema mapping + project list
```

Sidebar groups:
- **Portfolio**: Portfolio Overview, Data Quality, Ask Your Data, Generate Report, Settings
- **Projects**: MIRAY TB, MCHP, MAFY, TIA LONGO, PROFESS (each links to its project dashboard; sub-nav appears on project pages)

Upload route is removed from primary nav (kept only inside Settings as "Import data") since the brief now assumes datasets exist in cloud storage.

## The 5 Projects (distinct KPI schemas)

Defined in `src/lib/projects.ts` as a typed catalog. Each project has its own indicator set, district list, KPI cards, charts, top insights, data issues, action items, health score, and status lights.

| Project | Focus | Signature indicators |
|---|---|---|
| MIRAY TB | Tuberculosis program | TB cases detected, treatment success rate, contact tracing coverage, DOTS adherence, sputum smear positivity |
| MCHP | Maternal & Child Health | Antenatal visits (ANC4+), skilled birth attendance, child vaccinations, postnatal visits, under-5 consultations |
| MAFY | Nutrition | SAM/MAM screenings, admissions, cure rate, RUTF stock days, MUAC coverage |
| TIA LONGO | Primary care / outreach | Outpatient visits, outreach sessions, referrals, facility reporting completeness, distance-to-facility |
| PROFESS | Health worker training | CHWs trained, supervision visits, knowledge test pass rate, kits distributed, retention rate |

Each project also carries: region (north/east/highlands/south), donor, reporting period, traffic-light status, and a `needsAttention` flag used by the Portfolio Overview.

## Portfolio Overview (`/portfolio`) — primary landing inside the app

Answers "What needs my attention today?":

1. **Attention banner** — top 3 cross-project alerts ("MIRAY TB: treatment success dropped 8pp in Sambava", "MAFY: RUTF stockouts in 2 districts", "MCHP: 1 facility missing report 2 months").
2. **Portfolio KPI strip** — total beneficiaries reached, active projects, facilities reporting, open data issues, overdue reports.
3. **Project cards grid** (5 cards) — each shows project name, donor, health score gauge, traffic-light status, 1-line "what changed" (e.g. "ANC4+ ↑ 12% vs last month"), and a "Needs attention" badge when relevant. Click → project dashboard.
4. **Cross-project trend strip** — small sparklines of one key indicator per project.
5. **Upcoming reports** — list of donor reports due, with "Generate" shortcuts.

## Project Dashboard (`/projects/$projectId`)

Answers performance / change / attention / next-step. Sections:

- Project header: name, donor, period, region, status badge.
- Health score + 4 traffic-light status cards (project-specific).
- 5 project-specific KPI cards with deltas vs previous period.
- "What changed" panel: 3–5 bullet insights with direction icons (improving / declining / unusual).
- Charts (project-specific): main trend line, district/facility breakdown bar, completeness area, plus one project-flavored chart (e.g. treatment outcome donut for MIRAY TB, ANC funnel for MCHP).
- Madagascar map highlighting the project's operational districts.
- **External context panel** (new): timeline chips of hardcoded events overlapping the reporting period (Cyclone Gamane Mar 2024, measles outbreak Q2 2024, fuel shortage Aug 2024, Easter holiday week, etc.), each tagged with affected regions. Shown as "possible explanations" near the trend it might explain.
- "Recommended next steps" → links into Action Center / Data Quality / Report.

## Data Quality

Two entry points:
- Portfolio-level: filterable issues across all projects, with project column.
- Per-project: same table scoped to that project.

Each issue keeps: what happened, why it matters, recommended action (already in `DATA_ISSUES` — extend per project).

## Ask Your Data

- Portfolio-level chat scoped to all projects.
- Per-project chat scoped to one project; project context shown in header chip.
- `askCopilot(prompt, { projectId? })` extended with project-aware keyword routing.
- New mock capability: when a question is about a trend, response may include an "External context" block referencing the hardcoded events catalog when the time/region matches. Always phrased as "possible explanation, not confirmed cause".
- Suggested prompt chips differ per project ("Why did TB treatment success drop in Sambava?", "Which MCHP facilities missed reports?", etc.).

## Report Generator

Form:
- Project: dropdown (5 projects + "Portfolio / Annual")
- Reporting period: dropdown (Q1–Q4 2024, H1 2024, Full year 2024)
- Report type: Donor report / Annual report / Internal report

On Generate (mocked 1.5s):
- Executive summary
- KPI overview table (project-specific)
- Trend analysis (with one external-context callout)
- Data quality notes
- Recommendations
- Impact story (1 short narrative paragraph + 1 anonymized vignette)

Export buttons remain stubs (toast "PDF export coming soon").

## External Context Catalog

`src/lib/external-context.ts` — array of `{ id, date, type: 'cyclone'|'outbreak'|'political'|'holiday'|'logistics', title, regions[], description }`. Helper `getContextFor({ period, regions })` returns relevant events. Used by project dashboards, Ask Your Data mock, and Report Generator.

## Files

**New**
- `src/lib/projects.ts` — project catalog + per-project sample data
- `src/lib/external-context.ts`
- `src/routes/_app.portfolio.tsx`
- `src/routes/_app.projects.$projectId.tsx` (layout with sub-nav + Outlet)
- `src/routes/_app.projects.$projectId.index.tsx` (project dashboard)
- `src/routes/_app.projects.$projectId.data-quality.tsx`
- `src/routes/_app.projects.$projectId.ask.tsx`
- `src/routes/_app.projects.$projectId.report.tsx`
- `src/components/ProjectCard.tsx`
- `src/components/AttentionBanner.tsx`
- `src/components/ExternalContextPanel.tsx`
- `src/components/ProjectSubnav.tsx`

**Edited**
- `src/components/AppSidebar.tsx` — Portfolio group + Projects group with 5 entries
- `src/routes/_app.tsx` — header shows current project chip when on project routes
- `src/routes/_app.dashboard.tsx` → repurposed to redirect to `/portfolio` (or deleted; old `/dashboard` removed from nav)
- `src/routes/_app.ask.tsx`, `_app.data-quality.tsx`, `_app.report.tsx` — adapted to portfolio scope with project filter
- `src/lib/ai-mock.ts` — project-aware routing + external-context injection
- `src/lib/sample-data.ts` — kept as shared helpers; project-specific data moves to `projects.ts`
- `src/store/dataset.ts` → renamed concept to `useWorkspace` with `activeProjectId`; no upload gating (assume data is always loaded)
- `src/routes/index.tsx` — landing CTA goes to `/portfolio` instead of `/upload`

**Removed from primary nav**
- `/upload`, `/dashboard`, `/actions` (Action Center merges into project dashboard "Recommended next steps" + Data Quality)

## Demo Flow

1. Landing → Open Portfolio
2. Portfolio Overview shows attention banner + 5 project cards
3. Click MIRAY TB → project dashboard with "what changed", external context (Cyclone Gamane near Sambava)
4. Ask Your Data (project-scoped): "Why did treatment success drop in Sambava?" → AI answer + external context callout
5. Generate Report → choose MIRAY TB, Q1 2024, Donor → see full report with impact story
6. Back to Portfolio → open PROFESS to show different KPI schema

## Out of Scope

Real cloud data fetch, real AI calls, real PDF/PPT export, auth, multi-tenant projects, editing project metadata.
