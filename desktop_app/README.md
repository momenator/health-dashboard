# DfM Data Check

Desktop app that checks a CSV export against the Data Quality Index (DQI) and shows which values don't make sense. Everything runs locally; nothing leaves the computer. Plan and design decisions: [`docs/tauri-app.md`](../docs/tauri-app.md). DQI spec: [`docs/dqi-docs.txt`](../docs/dqi-docs.txt).

Vite + React + TypeScript single-page app, wrapped by [Tauri 2](https://tauri.app).

## Prerequisites

- Node 22.12 or newer; 24.6.0 is pinned in `.nvmrc` (`nvm install && nvm use`). Node 20 does not work: Vite 8 needs 20.19+ and Vitest 5 needs 22.12+.
- For the desktop build only: Rust (stable) and the Tauri system prerequisites (Xcode command line tools on macOS; WebView2 and the MSVC build tools on Windows)

```sh
npm install
```

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | App in the browser at http://localhost:1420, **in editor mode** |
| `npm test` | Engine, scoring, Excel export and `rules.json` tests (uses `../data/reporting/`) |
| `npm run lint` / `npx tsc` | Lint / type check |
| `npm run build` | Static build in `dist/` (release mode: rules are read-only) |
| `npm run build:editor` | Static build with the rule editor switched on |
| `npx tauri dev` | Desktop window with hot reload (editor mode) |
| `npx tauri build` | Installer for this OS in `src-tauri/target/release/bundle/` (`.dmg`/`.app` on macOS, `.msi`/`.exe` on Windows) |

CI (`.github/workflows/desktop-app.yml`) runs the tests on every change. Run the workflow manually to get macOS and Windows installers as build artifacts. The installers are **not code-signed** yet: macOS shows an "unidentified developer" warning (right-click → Open the first time) and Windows SmartScreen asks for confirmation.

## Changing the rules

Every installation runs the same rules: they live in [`src/rules/rules.json`](src/rules/rules.json) and are bundled into each release.

1. Run the app in editor mode (`npm run dev` or `npx tauri dev`) and open a real export.
2. Open **Rules**. Turn rules on or off, edit them, add new ones, or tune the built-in checks; the file is re-checked on every change so you can see the effect.
3. Change the **Version** (e.g. `2026-10-02.1`) and click **Save rules.json**.
4. Replace `src/rules/rules.json` with the saved file, run `npm test`, commit, and release a new build.

You can also edit `rules.json` by hand; `npm test` validates it against the schema in [`src/lib/dqi/schema.ts`](src/lib/dqi/schema.ts).

Rule types: `range`, `allowed`, `compare`, `dateOrder`, `sum`, `requiredIf`, `required`, `unique`. A rule only runs on files that contain every column it names.

## Code map

```
src/lib/dqi/        the engine: parse → detect columns → rules + built-in checks → score (pure, no React)
src/lib/view.ts     turns the current selection into table rows
src/store/app.ts    Zustand store (open file, result, selection, rules)
src/components/     OpenFile, Results, Summary, ProblemNav, DetailPanel, FlaggedRowsTable, RecordDrawer, RulesDrawer
src/rules/          rules.json + loader
src-tauri/          Tauri shell (window, CSP, dialog + fs plugins for saving files)
```
