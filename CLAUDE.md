# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A loose collection of standalone diagram and presentation assets about software delivery flow (Theory of Constraints thinking-process trees, value-stream before/after slides) plus a spec for a planned simulator. It is not a git repo and has no build system, package manager, linter config, or tests. Each file is self-contained.

## Files

- `current-reality-tree.mermaid` — Current Reality Tree (`graph BT`): root causes → effects → the undesirable effect "We can't deliver changes daily". Three branches: validation/governance, integration & batch size, work definition.
- `future-reality-tree.mermaid` — Future Reality Tree mirroring the CRT's three branches: injections → effects → desired effect "We are able to deliver changes daily".
- `daily-crt.mermaid` — Simplified linear CRT (`graph LR`) for "We cannot deliver today's work today".
- `crt.html` — Two-slide "Before / After" value-stream slideshow (1280×720 slides scaled via CSS `zoom`, arrow-key navigation, light/dark toggle persisted in `localStorage`). Uses Tailwind CDN (preflight disabled), Font Awesome, and Google Fonts (Urbanist).
- `sim.spec.md` — Spec for an unbuilt "AI vs. Human Code Review Simulator" (React + Tailwind + Lucide React). Read it in full before implementing; it defines state variables, default/ranges for rates, the 100ms tick engine, lane layout, and edge cases.

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
