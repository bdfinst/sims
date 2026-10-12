# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A collection of diagram and presentation assets about software delivery flow (Theory of Constraints thinking-process trees, value-stream before/after slides) plus a built web app: the "AI vs. Human Code Review Simulator". The diagram and slide files are standalone with no tooling. The simulator is a Vite + React project at the repo root with its own build, unit tests (Vitest), e2e tests (Playwright), linters, and git hooks.

## Files

- `current-reality-tree.mermaid` — Current Reality Tree (`graph BT`): root causes → effects → the undesirable effect "We can't deliver changes daily". Three branches: validation/governance, integration & batch size, work definition.
- `future-reality-tree.mermaid` — Future Reality Tree mirroring the CRT's three branches: injections → effects → desired effect "We are able to deliver changes daily".
- `daily-crt.mermaid` — Simplified linear CRT (`graph LR`) for "We cannot deliver today's work today".
- `crt.html` — Two-slide "Before / After" value-stream slideshow (1280×720 slides scaled via CSS `zoom`, arrow-key navigation, light/dark toggle persisted in `localStorage`). Uses Tailwind CDN (preflight disabled), Font Awesome, and Google Fonts (Urbanist).
- `before-value-stream.html` — Standalone value-stream slide. Not part of the simulator; don't modify it unless asked.
- `sim.spec.md` — Original input spec for the simulator. Superseded by `docs/specs/ai-vs-human-code-review-simulator.md`, which is the model spec.
- `docs/specs/ai-vs-human-code-review-simulator.md` — The simulator's spec: architecture, acceptance criteria, glossary, and the Research Sources table. Read it before changing model behavior or the research panel.
- `index.html`, `src/`, `e2e/`, `features/`, `plans/`, `tools/`, and the root config files (`vite.config.js`, `vitest.config.js`, `playwright.config.js`, `eslint.config.js`, `.oxlintrc.json`, `prettier.config.js`) make up the simulator. See "Simulator app".
- `metrics/verify-log.jsonl` — Append-only log of per-slice verification runs, written by the dev-team build workflow. Not part of the app; don't edit it by hand.

## Simulator app

On screen, top to bottom:

- The header: title, description, Start/Pause, Reset, the Running/Paused status, the elapsed work hours, and the warning-threshold slider.
- The headline band: the AI ÷ Human incidents-per-PR ratio.
- The Human lane above the AI lane. Each reads left to right: generation inputs → Pending Review box (PR tiles, "+N more" overflow) → review controls → metrics grid. Below the `md` breakpoint each lane stacks vertically.
  - Generation inputs: Human has code written (LOC/hr) and PRs per day; AI has code written (LOC/hr). The Human PR size is derived: LOC/hr × 8 (`WORK_HOURS_PER_DAY`) ÷ PRs per day. The AI PR size is the human size × the Faros multiplier, and AI PRs per day are derived and read-only.
  - Review controls: Reviewer speed (Human lane, applies to both) and the AI skim multiplier (AI lane). With the header's threshold slider, that is six sliders.
- The collapsible research panel below the lanes, collapsed by default.

Two lanes (human-authored vs. AI-authored code) run side by side; generation outpaces review in the AI lane, so its queue overflows and more defects escape. One simulated second is one work hour. The model math, defaults, and ranges live in the spec; expected values in tests come from the "Default arithmetic" section of `plans/ai-vs-human-code-review-simulator.md`, so don't change a test's expected number to make it pass.

- `src/engine.js` — pure model, display helpers, formatters, and constants. ESLint forbids importing React, `lucide-react`, `./components/*`, or `./laneConfig*` here and in `reducer.js` and `openTip.js`. Those rules run only in `npm run lint:deep`, which the pre-push hook runs; run it yourself after touching any of the three files.
- The Faros figures (+51% PR size, +16.2% PR merge rate, +242.7% incidents per PR) are constants in `engine.js`. The lane text, the AI code-written default, the info tips, and the research note all derive from them, so change them only there.
- `src/reducer.js` — pure state transitions (tick, start, pause, reset, setSetting).
- `src/laneConfig.js` — presentation only: labels, icons, colour/type class tokens, tile layout, and each slider's label and info-tip text (`SLIDER_PRESENTATION`).
- Info tips: every slider has an info button ("About <label>") whose tip is also the slider's accessible description. `src/openTip.js` is the pure open/close reducer for the plan's truth table. `useOpenTip` (hook over it) and `InfoTip` live in `src/components/`.
- `src/research.js` — data for the collapsible research panel (findings, URLs, assumptions note). The assumption figures in the note come from `engine.MODEL_ASSUMPTIONS`, so change those constants in `engine.js`, never in `research.js`.
- `src/components/` — React components; `src/App.jsx` owns the reducer and the 100 ms tick loop.
- `e2e/` — Playwright specs plus `fixtures.js` (shared helpers and a request guard that fails any test that makes an external request). Specs run in parallel and use `page.clock` for time. `generation.spec.js` covers the generation model and `info-tips.spec.js` the info tips.
- `features/ai-vs-human-code-review-simulator/slice-N-*.feature` — Gherkin scenarios exported from the plan, one file per slice. Tests that implement a scenario use its title (outline tests append `: <row>`).
- `tools/gherkin-sync/` — a Playwright reporter (wired in `playwright.config.js`) that fails the e2e run when a scenario test's top-level `test.step` titles differ from the scenario's step lines (keyword plus text, Background first, outline values filled in). Missing scenarios and Examples rows are reported only on a full, unfiltered run. `npx playwright test --list` checks just that every scenario has a test. Scenarios tagged `@wip` are skipped and counted; `GHERKIN_SYNC_STRICT=1` fails the run while any remain. A step may tag scenarios `@wip` in the plan and mark their tests `test.fixme` with `// @wip: Step N.M`. Before a PR there must be zero `@wip` and no `test.fixme`.
- Unit tests sit next to their source (`src/**/*.test.js`); `src/testHelpers.js` holds their shared helpers.
- `docs/specs/`, `plans/` — the spec and the implementation plan.

Test rules:

- Spec values that e2e tests check against (tick period, defaults, expected numbers) are declared in `e2e/fixtures.js` or the `*.spec.js` file that uses them, never imported from `src/`. A test that imports the value it checks can't catch that value being wrong.
- A test's actions must match its Gherkin scenario's steps exactly: the same keys, controls, and press counts. Wrap each step's code in `test.step('<exact step line>', …)`; the reporter checks the titles, and reviewers check that the code does what the title says. To change a scenario, edit it in the plan and re-export with `python3 <dev-team plugin>/scripts/plan_gherkin_export.py plans/ai-vs-human-code-review-simulator.md`, then change the test.

## Commands

- Setup: `npm install` (its `prepare` script installs the husky hooks), then `npx playwright install chromium`.
- `npm run dev` — Vite dev server.
- `npm run build` — produces one self-contained `dist/index.html` (all JS and CSS inlined).
- `npm test` — Vitest unit tests. One test: `npx vitest run src/engine.test.js -t "<name>"`.
- `npm run test:coverage` — unit tests with V8 coverage. It counts only files the unit tests import; components are covered by the e2e suite.
- `npm run test:e2e` — Playwright; builds and previews on port 4173 first. One file: `npx playwright test e2e/<file>`.
- `npm run lint` (oxlint), `npm run lint:deep` (ESLint, includes the import-boundary rules), `npm run format:check` (Prettier).
- Husky: pre-commit runs lint-staged (Prettier, oxlint --fix); pre-push runs `npm run lint:deep`, `npm test`, and `npm run test:e2e`.

## Before presenting

- Present from the built `dist/index.html`; it works offline from `file://`.
- Re-check the five research URLs in the spec's Research Sources table before a major talk. Links open in a new tab and no test follows them.

## Conventions in the Mermaid diagrams

- Node roles are encoded both as a bracketed prefix in the label (`[Root]`, `[Effect]`, `[Undesirable Effect]`, `[Injection]`, `[Desired Effect]`) and as a `classDef` (`root`, `effect`, `ude`, `injection`, `de`). Keep both in sync when adding nodes.
- Labels are manually wrapped with `<br>` to keep boxes narrow; follow the same short-line wrapping.
- Edges point cause → effect (bottom-to-top in `graph BT`). Nodes and edges are grouped by branch with `%%` comments.
- The CRT and FRT are paired: a branch added or renamed in one usually needs a counterpart in the other.

## Rendering / previewing

- Mermaid: render with the Mermaid CLI if needed, e.g. `npx -p @mermaid-js/mermaid-cli mmdc -i current-reality-tree.mermaid -o out.svg`.
- HTML: open `crt.html` directly in a browser; no server required.

## Known issue in `crt.html`

The file appears damaged by a copy/paste: several CSS block comments are unterminated (`/* Dark Theme /`, `/* Timeline Layout Specifics /`), JSDoc comments in the `<script>` begin with a bare `/` and `⚬` bullets, and template literals in `updateUi()` are missing backticks. These break parts of the styling and the slideshow script; fix them when editing the file.
