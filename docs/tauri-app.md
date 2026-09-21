# Data Check: CSV Data-Quality Desktop App (Tauri)

> **Status (2026-09-18):** iterations 1–3 are implemented in [`desktop_app/`](../desktop_app/README.md). 45 tests pass (`npm test`), and `npx tauri build` produces a `.app` and `.dmg` on macOS. Windows installers come from the manual CI workflow (`.github/workflows/desktop-app.yml`), which hasn't run yet. Deviations from the plan found while building are marked **(changed during implementation)**.

## Context

Goal: a desktop app that non-technical program staff at Doctors for Madagascar (DfM) can install and run with a double-click, which checks a CSV against the Data Quality Index (DQI) and shows which values don't make sense, so they can be corrected at the source.

This document replaces the earlier plan (DQI + AI report generation). What changed, as of 2026-09-18:

- **Report generation is dropped.** The donor-report feature from the original hackathon challenge is "currently less important" per DfM. With it go the LLM, OpenAI calls, prompts, chart heuristics, PowerPoint export and the API-key setting.
- **No LLM at all.** None of DfM's three priority features (data quality, performance monitoring, visualizations) needs one. Everything is deterministic, so nothing leaves the machine and there is no API cost.
- **No PII sanitization.** It only existed to protect data sent to an LLM/cloud. Data now stays local. The old phone-number regex also destroyed dates and decimals (see [Known issues](#known-issues)).
- **One rule library instead of per-project configs.** The DQI spec (`docs/dqi-docs.txt`) defines a config per survey. Instead, every rule declares the columns it needs and runs on any file that has them, plus built-in checks that run on every CSV without configuration.
- **Every installation has the same rules.** The rules ship inside the app. Staff can see every rule and what it flags but can't change them; the data team changes rules and publishes a new release (see [Changing rules](#changing-rules)).
- **A new, separate project: `desktop_app/`.** A plain Vite + React + TypeScript single-page app, wrapped by Tauri. The existing `FE/` app (TanStack Start with server rendering, built for the hosted dashboard) is not reused as a codebase.
- **The UI is two screens.** The portfolio/projects/maps/Ask/Report pages don't serve this app.

The approved UI mockup (runs the prototype engine on the real `data/reporting/` tables): https://claude.ai/artifact/1GW5ruKDhGS68CJRShcpKe. It is the visual reference for this plan. It lets anyone edit rules; in the app, only the data team's editor mode can (see [Changing rules](#changing-rules)).

Left untouched as legacy/reference, not part of this app: `FE/`, the Python backend (`app/`) and its tests, and the AWS infra (`infra/terraform`, `docs/aws-setup.md`).

## Scope

| | |
|---|---|
| **In (this plan)** | Open a CSV → DQI score and dimension scores → flagged rows with highlighted cells, grouped by rule, column or data-entry person → view the rules → Excel export → Tauri installer. Rule editor for the data team (editor mode). |
| **Later** | Performance monitoring alerts · visualizations of trends · saved run history (DQI over time) · "mark this value as correct" · sending issue lists to agents automatically · `.xlsx` input · rules updated without a new release · possibly an LLM to *draft* rules for a new file type (human-reviewed) |
| **Out** | Report generation, Ask/chatbot, LLM calls, PII sanitization, any backend or cloud service, rule editing by staff |

## Architecture

Single-process Tauri app: Rust shell + system webview. All logic is TypeScript in the frontend. No sidecar, no server, no network calls.

```
desktop_app/
  package.json, vite.config.ts, tsconfig.json, index.html
  src/
    main.tsx, App.tsx        two screens switched by state (no router)
    styles.css               design tokens copied from FE/src/styles.css
    components/ui/           the shadcn components we need, copied from FE
    components/              OpenFile, Results, DimensionTiles, ProblemNav,
                             FlaggedRowsTable, RecordDrawer, RulesDrawer
    store/app.ts             Zustand: dataset, result, selection
    rules/rules.json         THE rule library + built-in check settings
    lib/dqi/
      types.ts               Rule, RuleType, Check, Violation, DimensionScore, DqiResult
      schema.ts              zod schema for rules.json
      parse.ts               CSV → { columns, rows } (papaparse), column profiling
      detect.ts              guess ID / data-entry person / source-row columns
      rules.ts               rule types: applicability, evaluation, description text
      builtin.ts             checks that need no configuration
      score.ts               dimension scores, DQI, grade, intensity
      engine.ts              runDqi(dataset, ruleSet) → DqiResult
      excelExport.ts         3-sheet workbook
      __tests__/             Vitest, against data/reporting fixtures
  src-tauri/                 added in iteration 3
```

- **Why a new project instead of `FE/`:** `FE/` is built on TanStack Start with server rendering, nitro and Lovable's Vite config, and carries ~40 pages/components this app doesn't use. A Tauri app needs static files only. Starting clean is less work than stripping `FE/` down, and leaves the old dashboard intact.
- **What's copied from `FE/`** (copied, not imported; the projects stay independent): the colour/radius tokens and Inter font from `FE/src/styles.css`, and the shadcn components we use (`tabs`, `switch`, `sheet`, `tooltip`, `select`, `button`, `badge`, `sonner`).
- **No router:** "open file" and "results" are one piece of state. Drawers are overlays.
- **The engine is pure** (`runDqi` has no React, no I/O), so it can be tested directly. The mockup's inline script is a working reference implementation of it.

**Dependencies:**
- **Iteration 1:** `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `@tailwindcss/vite`, `papaparse`, `zod`, `zustand`, `vitest`. Inter and JetBrains Mono are bundled from `@fontsource-variable/*` so the app needs no network.
- **Iteration 2:** Radix packages behind the copied shadcn components, `lucide-react`, `sonner`, `@tanstack/react-virtual` (row virtualization).
- **Iteration 3:** `exceljs`, `@tauri-apps/cli`, `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`.

## The DQI engine

### Scoring (from the spec, `docs/dqi-docs.txt` §3–8)

- **Unit:** the spec scores per *respondent*. DfM data is routine service records, so a respondent = **one row** (a patient, trip, activity or worker).
- **Dimension score** = `(1 − rows with ≥1 violation in that dimension / total rows) × 100`. A row counts once per dimension regardless of how many checks it fails.
- **Weights:** Uniqueness, Consistency, Validity, Plausibility at 25% each. Completeness and Conformity are computed and shown but weighted 0 ("reported only").
- **DQI** = `Σ(score × weight) / Σ weight` over **assessed** dimensions only. A dimension with no applicable check is shown as "n/a" and excluded, never shown as 100.
- **Grades:** Excellent ≥ 90 · Good ≥ 80 · Acceptable ≥ 70 · Poor ≥ 60 · Critical < 60.
- **Intensity:** per row, the number of failed checks in Consistency, Validity and Plausibility. Shown in the record view; the mean across flagged rows is shown per dimension.
- **Score vs. issue list:** the score counts rows; the issue list shows every violation (one row can appear several times).

### Rule library

Rules are **data** (`desktop_app/src/rules/rules.json`), built from a fixed set of types. The engine only knows these types; nobody writes formulas.

| Type | Dimension | Parameters | Example |
|---|---|---|---|
| `range` | Validity | column, min?, max? | age 0–110 |
| `allowed` | Validity | column, values[] | sex ∈ {female, male} |
| `compare` | Consistency | a, op (`<= < >= > =`), b | cocoa land ≤ total land |
| `dateOrder` | Consistency | earlier, later (ISO dates or HH:MM times) | discharge ≥ inclusion |
| `sum` | Consistency | parts[], total (column or number), tolerance | men + women = total |
| `requiredIf` | Conformity | when, equals[], then, expect (filled/empty) | TB positive → treatment start filled |
| `required` | Completeness | columns[] | key intake fields filled |
| `unique` | Uniqueness | column | one row per patient |

`rules.json` shape: `{ version, rules: [{ id, label, type, params, enabled }], builtin: { identical, textInNumbers, future, outliers, k, minN, spelling, ignoredColumns[] } }`. It's validated with `zod` by a unit test, so an invalid file fails CI instead of the installed app.

**Applicability:** a rule runs only if the file has every column it references, `required` included **(changed during implementation:** the plan let `required` run on whichever of its columns existed, which made the MCHP intake rule also run on TB and sensitization files because they share `sex`/`age`/`site`**)**. Otherwise it's listed under "Doesn't apply to this file" with the missing columns named. There is no dataset-type detection or config picking.

**Evaluation details:**
- Empty values (`""`, whitespace, `---`) are skipped by every type except `required`/`requiredIf`.
- `range`: non-numeric text in the column is itself a violation.
- `dateOrder` and `sum` skip a row when any involved value is empty.
- Every violation carries `{ row, cells[], message }`. `cells` lists all columns involved so the UI highlights both sides of a cross-field rule.

### Changing rules

Every installation has the same rules because they're part of the build:

1. A data-team member runs the app in **editor mode**: `npm run dev` in `desktop_app/`, or a build with `VITE_RULE_EDITOR=true`.
2. The Rules drawer then works like the mockup: on/off switches, edit forms, add/delete rules, built-in check settings, and the quick actions on the results screen ("Edit rule", "Turn off", "Change sensitivity", "Stop checking this column"). Edits apply straight away so their effect on real files can be checked.
3. **Save rules.json** writes the file: a download in the browser, a save dialog under Tauri. They replace `src/rules/rules.json`, commit, and the tests run.
4. The next release ships the new rules to everyone. The results screen shows the rules version (`rules.json` `version`) so it's clear which rules a file was checked with.

In normal (release) builds the Rules drawer is **read-only**: every rule with its description and status on the current file, grouped as "Applies to this file" and "Waiting for other files". Staff can't turn rules off or edit them, so two installations always give the same score for the same file.

### Built-in checks (run on every file, no configuration)

They skip the pipeline's metadata columns, the ID column and the row-number column. Their settings live in `rules.json` → `builtin`.

| Check | Dimension | Severity | Logic |
|---|---|---|---|
| Identical rows | Uniqueness | Worth a look | All fields equal to an earlier row; extras are violators, the first occurrence is shown but not flagged |
| Text in number columns | Validity | Needs fixing | Column ≥ 90% numeric; flag the non-numeric values |
| Dates in the future | Validity | Needs fixing | Column ≥ 90% ISO dates; flag dates after today |
| Unusual values | Plausibility | Worth a look | One check per numeric column. Tukey fence per spec §3.6: `[max(Q1 − k·IQR, 0 if all values ≥ 0), Q3 + k·IQR]`, `k = 3` by default. Skipped when fewer than `minN` = 30 values (spec §10), ≤ 5 distinct values, IQR = 0, the column is in `ignoredColumns`, or the name looks like an ID/code/year. Quantiles use linear interpolation. |
| Spelling variants | Validity, **not scored** | Worth a look | Text columns with 2–300 distinct values and ≤ 80% distinct. Normalize (strip accents, lowercase, drop non-alphanumerics); merge values with equal keys, or Levenshtein ≤ 1 (keys ≥ 5 chars), or Levenshtein 2 (keys ≥ 8 chars) when one spelling is rare (≤ 20% of the other). Values whose numbers differ are never merged, and Roman-numeral words count as numbers **(changed during implementation:** otherwise `Toliara_I` / `Toliara_II` and similar village names were merged**)**. The most frequent spelling is the suggested one; the others are flagged. |

**Severity** is separate from dimension. **Needs fixing** = rule violations (the rule encodes domain knowledge). **Worth a look** = statistical or heuristic findings that are often correct values (e.g. skewed costs, genuine repeat events).

### Column detection

- **ID column:** first of `record_id`, `patient_key`, `case_id`, `activity_uid`, `worker_id`, `id`, else a `*_id` column whose values are all unique.
- **Data-entry person:** first of `agent`, `community_agent`, `staff_responsible`, `interviewer`, `enumerator`, `hq_user`, `username`, else a column containing agent/staff/enumerator/interviewer.
- **Row number:** `source_row_number` if present (points to the row in the original Excel export), else the CSV line number.

Staff can override the ID and person columns on the results screen ("ID" and "Entered by" under the score). This only changes how results are displayed and grouped, not the score, so it doesn't break "same rules everywhere".

### Default rules (DfM tables in `data/reporting/`)

A first draft, to be reviewed with DfM. The counts are flagged rows produced by the engine on the current files, locked in by `desktop_app/src/lib/dqi/__tests__/fixtures.test.ts`. A blank means the count isn't asserted in a test.

| Rule | Type | Tables it applies to | Found |
|---|---|---|---|
| Age 0–110 | range | MCHP, TB, community workers | 0 |
| Sex ∈ {female, male} | allowed | MCHP, TB, community workers | |
| One row per `patient_key` / `record_id` | unique | all with the column | 0 |
| Discharge not before inclusion | dateOrder | MCHP | 206 |
| Patient + DfM amount = invoice (±1) | sum | MCHP | 9 |
| Payment shares = 100% (±0.5) | sum | MCHP | 6 |
| Household size 1–30 | range | MCHP | 0 |
| Consent ∈ {yes, no} | allowed | MCHP | |
| `chirurgical` → surgical intervention filled | requiredIf | MCHP | 0 |
| Key intake fields filled | required | MCHP | 5 |
| Result not before screening | dateOrder | TB | 57 |
| Treatment start not before screening | dateOrder | TB | 15 |
| Treatment end not before start | dateOrder | TB | 23 |
| `tpb_positive` → treatment start filled | requiredIf | TB | 32 |
| Weight 1–200 kg · Height 0.3–2.3 m · BMI 10–60 | range | TB | BMI: 23 |
| Screening result ∈ known codes | allowed | TB | |
| Key screening fields filled | required | TB | 124 (mostly empty `screening_result`) |
| Men + women = total participants | sum | Sensitization | 0 |
| Age groups = total participants | sum | Sensitization | 0 (the earlier "34" counted empty parts as 0) |
| Activity ends after it starts | dateOrder | Sensitization | 0 |
| Trip legs = total trip time | sum | Ambulance trips | 0 |
| Distance 0–500 km | range | Ambulance trips | 0 |
| Case count ≥ 1 | range | Ambulance causes | |
| Start date not after record date | dateOrder | Community workers | 0 |

Built-in checks on the same files found, among others: spelling variants in `clinical_evolution` (`gueri` / `guerri` / `Guéri` / `guerrie`), `community_agent` (`RANDRIA Gilbert` / `Randria Gilbert`) and `surgical_intervention`; 22 identical rows in `ambulance_causes` (possibly real separate cases); 177 "unusual" `height_m` values in TB (likely a narrow IQR, i.e. false positives, which is why outliers are "Worth a look").

## UI

Follows the mockup. Two screens, no sidebar.

**1. Open file:** drop zone / file picker for a CSV. Recently opened files can come later.

**2. Results:**

- **Header:** rules version and buttons: Open another file, Rules, Export to Excel.
- **Left panel:** one panel with the score on top and the problem list below. The right panel takes the rest of the window **(changed during implementation:** the six dimension tiles took too much room above the table**)**.
  - **Score:** file name, DQI with grade, record count. A **Details** popover holds the six dimensions (score, bar, weight or "reported only", flagged records, "n/a" when no check applies) and the ID / Entered by column pickers.
- **Problem list, three tabs over the same results:**
  - **By rule:** "Needs fixing", "Worth a look", "Passed" (collapsed), "Doesn't apply to this file" (collapsed, with missing columns). Each item shows the number of flagged rows.
  - **By column:** every column with flagged-row count, a bar and % empty.
  - **By person:** per data-entry person: flagged records out of total, how many need fixing, their most common issue. This is the first step toward notifying the person who entered the data.
- **Right panel, flagged rows:**
  - Only rows with problems. Columns: row number, ID, person, then only the columns involved in the selection, then "Why it was flagged". "Show all columns" widens it.
  - Offending cells highlighted red (needs fixing) or amber (worth a look); hover shows the reason.
  - Duplicates are shown as groups with the first occurrence included. Spelling variants show a chip row per column (suggested spelling + variants with counts); clicking a variant filters the table.
  - Actions: "View rule" (opens the Rules drawer at that rule) for everyone; a person gets "Export this list". The edit actions appear only in editor mode.
  - Virtualized rows (`@tanstack/react-virtual`) with sticky header and row-number column. The TB table is 4,495 × 56.
- **Record drawer** (click a row): all fields with flagged ones highlighted and explained, the row's issues (click to jump to the rule), and intensity per dimension.
- **Rules drawer:** read-only list as described in [Changing rules](#changing-rules); the full editor in editor mode.

## Excel export

`exceljs` workbook, saved with a native save dialog (`@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs`), following spec §4:

1. **Scores:** DQI, grade, rules version, each dimension's score, weight, flagged records and mean intensity; rules that ran and rules that didn't apply.
2. **Issues per record:** one line per flagged row (row number, ID, person, number of issues per dimension, issue messages), plus the row's values with offending cells filled red/amber.
3. **Issues per person:** per data-entry person: records, flagged records, issues by rule.

Plus "Export this list" for a single person: the same sheet 2 filtered to their rows, ready to send to them.

## Iterations

### Iteration 1: project and engine

- Scaffold `desktop_app/`: Vite + React + TypeScript, Tailwind v4 with the tokens copied from `FE/src/styles.css`, Vitest, ESLint/Prettier configs copied from `FE/`. `npm run dev`, `build`, `test`, `lint` scripts.
- Implement `src/lib/dqi/*` per [The DQI engine](#the-dqi-engine). Port from the mockup's script, but typed and split into the modules above.
- `src/rules/rules.json` with the default-rules table above, and `schema.ts`.
- Tests:
  - `rules.json` passes the zod schema, and rule IDs are unique.
  - Unit tests per rule type and built-in check on small hand-written tables (edge cases: empty values, `---`, non-numeric text, times vs. dates, sum tolerance, IQR = 0, < 30 values).
  - Scoring: prevalence counts a row once per dimension; unassessed dimensions are excluded from the DQI; the 0-weight dimensions don't affect it; grade breakpoints.
  - Fixture tests on `data/reporting/*.csv` (not `uploaded_donnees_export_2026_06_28.csv`) asserting the confirmed counts from the default-rules table.

### Iteration 2: UI

- Copy the needed shadcn components from `FE/src/components/ui/`.
- Build the open-file screen, results screen, record drawer and read-only Rules drawer per [UI](#ui).
- Editor mode (`import.meta.env.DEV || VITE_RULE_EDITOR`): the editable Rules drawer, quick actions, re-check on every edit, and "Save rules.json" (browser download for now).
- ID/person column override.

### Iteration 3: Tauri packaging and export

- Add `@tauri-apps/cli`, scaffold `desktop_app/src-tauri/` pointing at `vite build`'s `dist/`.
- `@tauri-apps/plugin-fs` + `plugin-dialog`: native file open, Excel save, and "Save rules.json" through a save dialog in editor mode.
- `excelExport.ts`.
- `tauri build` → `.dmg` / `.msi`. Confirm target platforms and set up GitHub Actions if cross-platform builds are needed. CI also runs the tests, so a broken `rules.json` can't be released.

## Verification

- **Iteration 1:** `npm test` in `desktop_app/` passes, including the schema test and the fixture tests on the reporting tables.
- **Iteration 2:** `npm run dev`, open each table in `data/reporting/`, and compare against the mockup:
  - scores and flagged counts match;
  - hover reasons and the record drawer are correct;
  - an unrelated CSV runs the built-in checks and lists all library rules as "doesn't apply";
  - in editor mode, editing a rule re-scores immediately, and replacing `src/rules/rules.json` with the saved file gives the same result after a rebuild;
  - `npm run build && npm run preview` (no editor flag) shows the Rules drawer read-only with no edit actions.
- **Iteration 3:** install the built package on a clean machine/account and double-click it (no terminal appears). Then:
  - open a CSV and confirm the rules version shown;
  - export Excel and check the three sheets by hand;
  - install on a second machine and confirm the same file gets the same score.

## Later phases

- **Run history:** save each run's scores locally (the spec runs DQI weekly and tracks it over time). Shows DQI trends and is the base for performance monitoring.
- **Performance monitoring:** alerts on over- and under-performance and unusual service-delivery trends, per site/agent/month, compared with targets or recent history. Deterministic.
- **Visualizations:** a fixed chart set per kind of table (volumes over time, by site, outcomes), built from deterministic aggregation.
- **"Mark as correct":** so a checked value isn't flagged again (needs run history / a local store).
- **Notifications:** sending each person their issue list (needs an email/SMS service; the per-person export covers it manually until then).
- **Rules without a release:** load `rules.json` from a shared location or update server, if releasing for every rule change becomes too slow.
- **Input formats:** `.xlsx` via `exceljs`; raw CommCare exports once available (their column names differ from the cleaned tables, so rules will need adding).
- **LLM-drafted rules:** suggest rules for a new file from its headers and sample values, reviewed by the data team in editor mode, then run deterministically.

## Known issues

- **`data/reporting/uploaded_donnees_export_2026_06_28.csv` is damaged.** The old PII phone regex `(?:\+?\d[\s().-]*){8,}` (`app/tools/pii.py:52`) replaced dates (`2025-07-03`), timestamps and long decimals (`44.56521739130434`) with `[REDACTED]`. Don't use it as a fixture.
- **Test data is already cleaned.** The other tables came out of an upstream pipeline that standardized some values, so real raw exports will score lower. Good enough to build against; revisit with raw CommCare exports.
- **The spec targets surveys.** Its Completeness/Conformity exclusions assume an ODK form that enforces required fields and routing. That may not hold for DfM's CommCare/Excel sources, but the weights stay 0 as in the spec until DfM says otherwise.
- **Outliers on skewed or small columns.** Tukey 3×IQR flags correct values on skewed data (costs, distances) and is unreliable below 30 values (spec §10), hence "Worth a look", `minN` and `ignoredColumns`.

## Open questions

1. **Required fields:** which fields must DfM always fill per table? The `required` rules above are guesses.
2. **Default rules review:** DfM to confirm ranges, allowed codes and cross-field rules, especially "age groups = total participants" and whether identical `ambulance_causes` rows are real cases.
3. **Who edits rules:** which data-team member(s) own `rules.json`, and how often do they expect to change it? This decides whether "a release per rule change" is enough.
4. **Performance targets** (for the later phase): does DfM have targets, e.g. screenings per agent per month?
5. **App identity and signing:** the bundle identifier is a placeholder (`org.doctorsformadagascar.datacheck` in `desktop_app/src-tauri/tauri.conf.json`), and installers aren't code-signed, so macOS and Windows show "unknown developer" warnings. Does DfM have an Apple Developer account and a Windows signing certificate?
