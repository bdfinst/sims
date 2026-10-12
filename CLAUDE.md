# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A collection of diagram and presentation assets about software delivery flow (Theory of Constraints thinking-process trees, value-stream before/after slides) plus a built web app: the "AI vs. Human Code Review Simulator". The diagram and slide files are standalone with no tooling. The simulator is a Vite + React project at the repo root with its own build, unit tests (Vitest), e2e tests (Playwright), linters, and git hooks.

## Files

- `current-reality-tree.mermaid` — Current Reality Tree (`graph BT`): root causes → effects → the undesirable effect "We can't deliver changes daily". Three branches: validation/governance, integration & batch size, work definition.
- `future-reality-tree.mermaid` — Future Reality Tree mirroring the CRT's three branches: injections → effects → desired effect "We are able to deliver changes daily".
- `daily-crt.mermaid` — Simplified linear CRT (`graph LR`) for "We cannot deliver today's work today".
- `crt.html` — Two-slide "Before / After" value-stream slideshow (1280×720 slides scaled via CSS `zoom`, arrow-key navigation, light/dark toggle persisted in `localStorage`). Uses Tailwind CDN (preflight disabled), Font Awesome, and Google Fonts (Urbanist).
- `before-value-stream.html` — Standalone value-stream slide (untracked). Not part of the simulator; don't modify it unless asked.
- `sim.spec.md` — Original input spec for the simulator. Superseded by `docs/specs/ai-vs-human-code-review-simulator.md`, which is the model spec.
- `docs/specs/ai-vs-human-code-review-simulator.md` — The simulator's spec: architecture, acceptance criteria, glossary, and the Research Sources table. Read it before changing model behavior or the research panel.
- `index.html`, `src/`, `e2e/`, `features/`, `plans/`, and the root config files (`vite.config.js`, `vitest.config.js`, `playwright.config.js`, `eslint.config.js`, `.oxlintrc.json`, `prettier.config.js`) make up the simulator. See "Simulator app".

## Simulator app

Two lanes (human-authored vs. AI-authored code) run side by side; generation outpaces review in the AI lane, so its queue overflows and more defects escape. One simulated second is one work hour. The model math, defaults, and ranges live in the spec; expected values in tests come from the reference arithmetic in `plans/ai-vs-human-code-review-simulator.md`, so don't change a test's expected number to make it pass.

- `src/engine.js` — pure model, display helpers, formatters, and constants. ESLint forbids importing React, `lucide-react`, `./components/*`, or `./laneConfig*` here and in `reducer.js`.
- `src/reducer.js` — pure state transitions (tick, start, pause, reset, setSetting).
- `src/laneConfig.js` — presentation only: labels, icons, colour/type class tokens, tile layout.
- `src/research.js` — data for the collapsible research panel (findings, URLs, assumptions note).
- `src/components/` — React components; `src/App.jsx` owns the reducer and the 100 ms tick loop.
- `e2e/` — Playwright specs plus `fixtures.js` (shared helpers and a request guard that fails any test that makes an external request). Specs run in parallel and use `page.clock` for time.
- `features/` — Gherkin scenarios exported from the plan, one file per slice. Test titles follow the scenario titles.
- `docs/specs/`, `plans/` — the spec and the implementation plan.

## Commands

- `npm run dev` — Vite dev server.
- `npm run build` — produces one self-contained `dist/index.html` (all JS and CSS inlined).
- `npm test` — Vitest unit tests. One test: `npx vitest run src/engine.test.js -t "<name>"`.
- `npm run test:e2e` — Playwright; builds and previews on port 4173 first. One file: `npx playwright test e2e/<file>`.
- `npm run lint` (oxlint), `npm run lint:deep` (ESLint, includes the import-boundary rules), `npm run format:check` (Prettier).
- Husky: pre-commit runs lint-staged (Prettier, oxlint --fix); pre-push runs `npm test` and `npm run test:e2e`.

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
