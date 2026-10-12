<!-- spec-version: 14.0.1 -->
# Spec: AI vs. Human Code Review Simulator

**Source:** `sim.spec.md` (validate mode), amended 2026-10-12 with the stakeholder's code-review research brief ("research brief" below), and amended again 2026-10-12 ("generation amendment" below): generation is now set as code written per hour plus PRs per day, PR size is derived, Faros data defines the AI lane, and every slider gets an info tip. Criteria cite their source section; criteria without a source citation come from a stakeholder answer or a logged inference.

## Intent Description

Build an interactive, browser-based simulation that shows why AI code generation creates a review bottleneck. Two lanes run side by side. In the human lane, people write code and people review it. In the AI lane, AI generates code and people review it. Changesets flow from generation into a review queue and then to deployment. When generation outpaces review, the queue grows without bound, turns red, and overflows.

Each lane's generation is set as code written per work hour. A PR's size follows from how much code is written between PRs. The human lane's PR frequency is set directly; a frequency below one PR per day means a PR spans more than one day. The AI lane follows Faros AI's data on high AI adoption: its PRs are 51% larger than the human lane's, and its default volume gives a PR merge rate 16.2% above the human lane's. The defaults model one developer, so neither queue grows at first. The presenter raises the AI lane's code written to show review falling behind.

The simulation also shows the quality cost. Human reviewers have fixed cognitive limits. Defect detection falls sharply once a review exceeds about 200–400 lines of code (LOC), or goes faster than about 500 LOC per hour. AI-generated PRs are larger, and reviewers skim them faster because the code looks clean. So more defects escape review and become production incidents. The simulator computes detection rate, escaped defects, incidents per PR, and pickup wait from those research-based rules. The ~3× incidents-per-PR effect emerges from the defaults rather than being hard-coded. A collapsible panel presents the research and its sources, and an info tip on every slider explains what it controls.

The audience is people watching a talk or a demo. The presenter changes code written, PR frequency, reviewer speed, and the skim effect live, and the effect on each queue and on incidents appears immediately.

## Architecture Specification

**Delivery**

- A Vite + React (JSX) project at the repo root. `npm run build` produces **one self-contained offline file**, `dist/index.html`, with all JS and CSS inlined by `vite-plugin-singlefile`. It needs no network at runtime and can be opened straight from disk or shared as a single file.
- Dependencies come from npm, not CDNs: `react`/`react-dom` 19, `lucide-react` for icons, and Tailwind CSS 4 through `@tailwindcss/vite`.
- Source layout (see the plan's module table for detail):
  - `src/engine.js`: pure model, with no React or DOM: constants, the numeric lane model, the slider table, the derived lane parameters, the detection curve, `tick`, and the formatters.
  - `src/reducer.js`: pure `reducer(state, action)` and `initialState` (`tick`, `start`, `pause`, `reset`, `setSetting`).
  - `src/laneConfig.js`: presentation only: labels, units, info-tip text, icon names, and class strings per lane and per slider, plus the tile layout.
  - `src/research.js`: findings data and the assumptions note.
  - `src/components/`: UI components.
  - `src/App.jsx`: `useReducer`, the tick-interval and visibility effects, and the page layout.
  - `src/main.jsx`: entry point.

**Components**

- `App`: owns the reducer state and the tick loop. Renders the header, the headline band, both lanes, and the research panel.
- `Header`: title, short description, a global warning-threshold slider, the Start/Pause and Reset buttons, the Running/Paused status, and the elapsed work hours.
- `HeadlineBand`: the AI ÷ Human incidents-per-PR ratio.
- `Lane`: one instance per lane, keyed by lane id. Shows the lane's sliders and its derived, read-only values (PR size; for the AI lane also PRs per day and effective speed).
- `QueueBox`: shows the count, item tiles, the overflow indicator, and the warning state.
- `LaneMetrics`: per-lane deployed, defects caught, incidents, incidents per PR, and pickup wait (shown through `MetricValue`).
- `RateSlider`: a labeled range input with an info tip after its label.
- `InfoTip`: an info button (lucide `Info` icon) that shows a short explanation on hover or focus.
- `ResearchPanel`: a collapsible section below the lanes with the research findings and their citations.
- `Icon`: maps an explicit set of icon names to named `lucide-react` imports and adds the `data-icon` hook.

**Time scale:** 1 simulated second = 1 work hour. Each 100ms tick = 0.1 work hour. A work day is 8 work hours. Code written, reviewer speed, and pickup wait are per work hour; PR frequency is per work day.

**State** (from §3, plus stakeholder additions, the research amendment, and the generation amendment)

| Control | Default | Range | Step | Applies to |
| --- | --- | --- | --- | --- |
| Human code written (LOC/hr) | 30 | 5–200 | 5 | Human lane |
| Human PRs per day | 1 | 0.25–4 | 0.25 | Human lane |
| AI code written (LOC/hr) | 53 | 5–2,000 | 1 | AI lane |
| Reviewer speed (LOC/hr) | 300 | 100–1000 | 50 | The same human reviewers serve both lanes |
| AI skim multiplier | 2× | 1×–3× | 0.5× | AI lane effective reviewer speed = speed × skim (600 at default) |
| Warning threshold (pending PRs) | 15 | 5–50 | 1 | Both lanes |

Derived lane parameters (read-only, recomputed from the current settings every tick):

- Human PR size (LOC) = human code written × 8 ÷ human PRs per day (240 at default).
- AI PR size (LOC) = human PR size × 1.51 (Faros: PR size +51%; 362.4 at default, shown as 362).
- AI PRs per day = AI code written × 8 ÷ AI PR size (1.17 at default; the Faros merge-rate input is ×1.162, and rounding the default AI code written to 53 gives ×1.170).
- PRs per hour for each lane = code written ÷ PR size.
- The AI code-written default 53 is the human default × 1.51 × 1.162 (= 52.6), rounded to the slider step.
- The model uses unrounded sizes; the UI rounds displayed sizes to whole LOC and AI PRs per day to two decimals.

- The original `humanReviewRate` and `aiReviewRate` sliders are **removed**. Review throughput is derived: PRs/hr = effective speed ÷ PR size.
- The research amendment's PR-size slider, PRs-per-hour generation sliders, and the 1.51 size multiplier on the PR-size slider are **removed** by the generation amendment.
- `isRunning` (default `false`).
- Per lane: `pendingLoc`, `pendingPrs`, `deployedLoc`, `deployedPrs`, `escapedDefects`.

**Engine** (per lane, per tick)

1. Generate: add `codeWritten ÷ prSize × 0.1` PRs and `codeWritten × 0.1` LOC to pending.
2. Review: `reviewedLoc = min(pendingLoc, effectiveSpeed × 0.1)`. PRs reviewed = `pendingPrs × reviewedLoc / pendingLoc`; this handles queued PRs of mixed size after a size change. Move both to deployed. Clamp pending to ≥ 0.
3. Detection rate `d = 0.8 × sizeFactor(avgPendingPrSize) × speedFactor(effectiveSpeed)`, where:
   - `sizeFactor(L)` = 1 for L ≤ 200; falls linearly to 0.05 at L = 400; 0.05 for L > 400.
   - `speedFactor(R)` = 1 for R ≤ 500; falls linearly to 0.1 at R = 1000; 0.1 above.
4. Escape: `escapedDefects += reviewedLoc × 0.02 × (1 − d)`. Defect density is 20 per 1,000 LOC in both lanes. Each escaped defect counts as one incident.
5. Derived display values:
   - incidents per PR = `escapedDefects ÷ deployedPrs` ("—" until the lane displays Deployed ≥ 1);
   - pickup wait (hours) = `pendingLoc ÷ effectiveSpeed`;
   - current detection % = `d` for the lane's current PR size and effective speed, labeled "Defects caught";
   - headline ratio = (AI escapedDefects ÷ AI deployedPrs) ÷ (Human escapedDefects ÷ Human deployedPrs), shown "—" until both lanes display Deployed ≥ 1;
   - elapsed work hours = ticks × 0.1.

- All counts show `Math.floor(x + 1e-9)`, so float sums of 0.1 display exactly (10, not 9).

**Engine**

- `tick(lane, params) → lane` is a pure function implementing steps 1–4 above (§4, §6).
- A `setInterval` of 100ms runs while `isRunning` is true. Each tick reads the current settings, so slider changes take effect on the next tick (§6).
- When the browser tab becomes hidden (`visibilitychange`), the simulation pauses automatically.

**Info tips**

- Every slider (the six in the State table) has an info button immediately after its visible label. Its accessible name is "About <slider label>".
- The tip opens while the pointer is over the button or the tip, and while the button has keyboard focus. It closes when both pointer and focus leave, or on Escape (WCAG 1.4.13: dismissible, hoverable, persistent). At most one tip is open at a time.
- The tip text is also the slider's accessible description, so screen-reader users hear it on the slider without opening the tip.
- Tip text states what the setting controls, its unit, and which lanes it affects. Any research claim in a tip uses only the Research Sources panel wording and never the wording marked "do not use".
- An open tip stays inside the viewport: no horizontal scroll at 320 px or 375 px.

**Constraints**

- Dark theme. The layout is responsive down to phone width with no horizontal scroll.
- Nothing is saved: no `localStorage`, no backend.

## Acceptance Criteria

**Controls**

- AC1: On page load, the simulation is paused and all counts show 0. *(stakeholder: initial state)*
- AC2: Start begins the simulation. The same button then reads Pause, and pressing it stops all count changes. *(§2 "Start, Pause"; §3 `isRunning`)*
- AC3: Reset sets all counts and metrics (pending, deployed, incidents) to 0 and pauses the simulation. Slider values do not change. *(§2 "Reset"; stakeholder: reset behavior)*
- AC4: Each slider shows its current value with units, and uses the default, range, and step in the State table. *(§3; stakeholder: step; research and generation amendments)*
- AC5: After a slider change while running, the next tick's displayed counts reflect the new value, and the simulation keeps running. *(§6 "Slider adjustments while running")*
- AC6: The warning-threshold slider (5–50, default 15) changes the threshold for both lanes. *(stakeholder: adjustable threshold)*
- AC23: Each lane shows its derived PR size as read-only text: Human "PR size 240 LOC" and AI "PR size 362 LOC" at the defaults. The AI lane also shows "1.17 PRs/day" and "Effective speed 600 LOC/hr" at the defaults. Each updates when a slider it depends on changes. *(generation amendment)*
- AC24: AI PR size is always human PR size × 1.51. Changing the human code written or PRs per day changes both lanes' PR sizes. Changing AI code written changes AI PRs per day and leaves both PR sizes unchanged. *(generation amendment: Faros PR size +51%)*

**Engine**

- AC7: With the default settings, after 10 seconds of running:
  - Human lane: pending 0, deployed 1, defects caught 65%, incidents 2, incidents per PR 1.69, pickup wait 0.0 h.
  - AI lane: pending 0, deployed 1, defects caught 15%, incidents 9, incidents per PR 6.16, pickup wait 0.0 h.
  - Headline ratio "3.65×".
  The plan's Default arithmetic re-derives these numbers from the engine rules. *(Engine rules; generation amendment)*
- AC7a: At the defaults, AI incidents per PR is between 3× and 4× human incidents per PR. *(Faros: 3× incidents per PR)*
- AC7b: Detection rate follows the size and speed factors:
  - at reviewer speed 300 and a human PR size ≤ 200 (for example, 25 LOC/hr at 1 PR/day), the human lane shows 80%;
  - at a human PR size ≥ 400 (for example, 50 LOC/hr at 1 PR/day), the human lane shows 4%;
  - at a human PR size of 200 and reviewer speed 900 (speed factor 0.28), the human lane shows 22%.
  *(research brief: 200–400 LOC wall, 500 LOC/hr limit, 70–90% baseline)*
- AC7c: Changing Human code written, Human PRs per day, or reviewer speed while running changes the detection rate and the incident accrual from the next tick (they change PR size or effective speed). Changing AI code written changes only the AI lane's PRs per day and its pending queue, never either lane's PR size or defects caught. *(§6; research and generation amendments)*
- AC7d: When AI code written exceeds the AI lane's effective review speed (above 600 LOC/hr at the defaults), the AI lane's internal pending LOC grows by (code written − effective speed) × 0.1 every tick; at 1,000 LOC/hr the displayed Pending LOC rises every tick and the queue passes the default warning threshold. *(generation amendment: presenter raises AI volume)*
- AC8: A queue never shows a negative value, even when the review rate is higher than the generation rate. *(§6 "Queue cannot be negative")*
- AC9: Deployed never decreases while the simulation runs. *(§4 review phase)*

**Display**

- AC10: Every count shows `Math.floor(x + 1e-9)` of its internal value. *(stakeholder: count display; exactness revision)*
- AC11: A queue box turns red and shows a warning icon when its displayed count is greater than `warningThreshold`. It returns to normal once the count drops back to the threshold or below. This applies to both lanes. *(§2 "turn red… >15"; stakeholder: both lanes)*
- AC12: Each queue box shows `min(displayed, C)` tiles, where the tile capacity C is between 22 and 98. When displayed > C, the box shows "+N more" with N = displayed − C. *(§5 "designed to overflow"; stakeholder: tiles)*
- AC13: The human lane uses blue/green colors with User and Eye icons. The AI lane uses purple with Bot and Eye icons, and red for its warning state. Each lane lays out generation → queue → review + deployed, left to right. *(§5)*
- AC14: The header shows the title "AI vs. Human Code Review Simulator", a one-sentence description, and the global buttons on the right. *(§1 Name, §5 Header)*
- AC15: The page has a dark theme and no horizontal scroll at 375px wide. On narrow screens, each lane stacks vertically. *(stakeholder: display)*
- AC16: Every slider has a visible text label, and you can operate every slider, info button, and button with the keyboard. Tab order runs Start, Reset, then each slider's info button followed by its slider. *(inference: native inputs; generation amendment: focusable info buttons)*
- AC17: Each lane shows pending LOC alongside pending PRs, and shows "Defects caught" %, incidents, incidents per PR, and pickup wait in hours. *(stakeholder: model all four findings; label "Defects caught")*
- AC21: A headline readout shows the live AI ÷ Human incidents-per-PR ratio (for example "3.65×"), computed from the simulation and never hard-coded. It shows "—" until both lanes *display* Deployed ≥ 1. *(stakeholder: hero metric)*
- AC22: An elapsed-time readout shows work hours ("10.0 work hours") with a "1 s = 1 work hour" note. It resets to 0.0 on Reset. *(stakeholder: time scale on screen)*
- AC18: A collapsible research panel below the lanes, collapsed by default, presents the five findings in Research Sources. It uses the Panel wording column verbatim, except the practitioner-observation finding, which uses its quoted paraphrase. Every figure links its source. Its "Model assumptions" note lists the defect density, the base detection rate, the detection floors, the curve thresholds, the human-lane defaults (an assumption), and that the AI lane's PR size and default volume come from Faros. *(stakeholder: collapsible panel; verification; generation amendment)*
- AC19: When the tab becomes hidden while running, the simulation pauses and the status shows "Paused". *(stakeholder: auto-pause)*
- AC20 (revised): `npm run build` produces `dist/index.html` with all JS and CSS inlined (no `<script src>`, stylesheet link, `modulepreload`, or file icon link). Opened from `file://`, it renders and runs and requests nothing but the document itself. The original CDN-failure criterion is withdrawn because there are no runtime CDNs. *(stakeholder: build step + offline single file)*

**Info tips**

- AC25: Every slider has an info button directly after its label, with the accessible name "About <slider label>" and an Info icon. *(generation amendment)*
- AC26: Hovering the info button, or giving it keyboard focus, shows the tip. The tip sits directly against its button (no gap), so the pointer can move onto it and it stays open. Unless pinned by a click, tap, Enter, or Space, it closes when the pointer and focus both leave; Escape always closes it without moving the pointer. Opening one tip closes any other. *(generation amendment; WCAG 1.4.13)*
- AC27: The tip text is the slider's accessible description. It names what the slider controls, its unit, and the lanes it affects, and contains none of the "do not use" wording ("near zero", "coined", "originated"). *(generation amendment; Research Sources rules)*
- AC28: With any tip open, the page has no horizontal scroll at 320 px and 375 px, and the open tip lies fully inside the viewport (all four edges). At 1280 × 720 the closed tips change no layout. *(generation amendment; AC15; projector fit)*

## Glossary

| Term | Definition | Status | Source |
| ------ | ------------ | -------- | -------- |
| Changeset / PR | One unit of code change that moves through generation → queue → deployed. It has a size in LOC. It is modeled as a continuous quantity and shown as a whole number. The UI says "PR". | `verified` | §1/§2; human chose floor display |
| LOC | Lines of code. Measures code written, PR size, and reviewer speed. | `verified` | Research brief |
| Code written | LOC a lane produces per work hour. Human and AI each have a slider. | `verified` | Human chose LOC/hr inputs (generation amendment) |
| PRs per day | How many PRs a lane opens per 8-hour work day. Set directly for the human lane; derived for the AI lane. Below 1 means a PR spans more than one day. | `verified` | Human chose per-day frequency |
| PR size | LOC per PR, derived: code written × 8 ÷ PRs per day (human); human PR size × 1.51 (AI). | `verified` | Human chose derived size; Faros +51% |
| Faros multipliers | AI PR size = human × 1.51 (PR size +51%); AI default volume gives PRs per day = human × 1.162 (PR merge rate +16.2%). | `verified` | Human: "Use Faros data as the source of truth" |
| Reviewer speed | LOC a human reviewer reads per work hour. The AI lane's effective speed = speed × skim multiplier. | `verified` | Human approved the model |
| Skim multiplier | How much faster reviewers read AI-generated code, because it looks clean (LinearB "2× faster"). | `verified` | Human chose a 1×–3× slider |
| Detection rate ("Defects caught") | The share of defects in reviewed code that the review catches. The UI labels it "Defects caught". | `verified` | Human approved the model and the label |
| Incident | An escaped defect after deployment. One escaped defect = one incident. | `verified` | Human approved the model |
| Pickup wait | Hours a newly queued PR waits before review reaches it, given the current queue and throughput. | `verified` | Human approved the model |
| Info tip | The short explanation a slider's info button shows on hover or focus. It is also the slider's accessible description. | `verified` | Human asked for hover info; chose a focusable button |
| Lane | One workflow (Human or AI) with its own rates, queue, and deployed count. | `unverified` | §2 "Dual Workflow Lanes" |
| Pending Review / Queue | Changesets generated but not yet reviewed. | `unverified` | §2, §3 |
| Deployed | Changesets that have been reviewed. Review completion counts as deployment. | `unverified` | §3 `humanDeployed` |
| Warning threshold | The displayed queue count above which a queue box shows the warning state. | `verified` | Human chose adjustable, global, default 15 |

## Ambiguity Log

| Decision | Classification | Resolved By | Rationale / Answer |
| ---------- | --------------- | ------------- | ------------------- |
| Delivery format | `requires-stakeholder-input` | human | **Revised 2026-10-12:** a Vite + React (JSX) build that outputs one self-contained offline `dist/index.html` (`vite-plugin-singlefile`), with Tailwind 4 via `@tailwindcss/vite` and `lucide-react`. It replaces the original "single HTML file with CDN libraries". |
| Display of fractional counts | `requires-stakeholder-input` | human | Whole numbers, floor. Alternative considered: one decimal place. |
| Warning scope and threshold | `requires-stakeholder-input` | human | Both lanes, with an adjustable threshold. |
| Threshold control shape | `requires-stakeholder-input` | human | One global slider, 5–50, default 15. |
| Reset behavior | `requires-stakeholder-input` | human | Clear counts and stop; keep slider values. |
| Initial `isRunning` | `requires-stakeholder-input` | human | Paused on load. Alternative considered: start automatically. |
| Queue visual | `requires-stakeholder-input` | human | Count plus item tiles, with a "+N more" overflow indicator. |
| Slider step size | `requires-stakeholder-input` | human | Step 1 for all sliders. Alternative considered: step 5 for AI generation. **Superseded** by the generation amendment's State table. |
| Theme and target screen | `requires-stakeholder-input` | human | Dark theme, responsive layout. |
| Warning compares the displayed or the internal value | `inferable` | inference | Compare the displayed (floored) value, so the color never contradicts the number shown. Check passed: the alternative (internal value, red while the box still shows "15") is ruled out by "exceeds… >15 items" being read against the visible count. |
| Lanes are independent | `inferable` | inference | Queues and generation are separate per lane. Reviewer *speed* is a shared setting, but each lane's review runs on its own (no capacity is split between lanes). **Revised by the generation amendment:** AI PR size follows the human PR size (Faros), so the human generation sliders affect the AI lane's PR size. |
| Tick increment is a fixed 0.1, not measured elapsed time | `inferable` | inference | §4 says "multiply… by 0.1 per tick". Check passed: the source rules out timing based on elapsed time. |
| Maximum visible tiles before "+N more" | `inferable` | inference | A visual tuning detail with no business meaning. Size it so the tiles fit the box at all breakpoints. Check: no plausible alternative changes observable behavior beyond AC12. |
| Accessibility (labels, keyboard) | `inferable` | inference | Native `<input type=range>` and `<button>` elements with labels give this at no extra cost. Check passed: no plausible developer would ship unlabeled sliders on purpose. |
| Header title text | `inferable` | inference | Use the §1 Name. The description sentence comes from the §1 Purpose. |
| CRUD for lanes, queues, and rates | `inferable` | inference | The model is in memory only. Changesets are counts, not records. Create = the generation tick; Update = review tick or slider change; Delete = Reset (AC3); Read = always visible. Nothing is saved (no `localStorage`). |
| Authentication / authorization | `inferable` | inference | Not applicable: a static, single-user demo page with no backend. |
| Audit / logging | `inferable` | inference | Not applicable: there is no state that must be recorded. |
| Dependency failure (CDN unavailable) | `requires-stakeholder-input` | human | **Withdrawn 2026-10-12:** with no runtime CDNs, AC20 and the loading message are dropped. |
| Internal number representation | `requires-stakeholder-input` | human | Human chose exact display (10, not 9.999… → 9). Integer tenths was the original mechanism. **Revised (inference):** reviewed PRs = pending PRs × reviewed LOC ÷ pending LOC, which is not integer, so exactness now comes from `Math.floor(x + 1e-9)`. Same observable behavior. |
| Research-driven model (sizes, curves, density, defaults) | `requires-stakeholder-input` | human | Approved as proposed. Defect density of 20/KLOC is an assumption, not from the research. The 0.05 and 0.1 floors stand in for "near zero". The 0.8 base detection rate is disclosed in Model assumptions. |
| Review-rate sliders | `requires-stakeholder-input` | human | Replaced by one shared reviewer-speed slider (LOC/hr); throughput is derived. |
| Skim multiplier control | `requires-stakeholder-input` | human | Slider 1×–3×, step 0.5×, default 2×. |
| Time scale | `requires-stakeholder-input` | human | 1 sim second = 1 work hour. |
| Research presentation | `requires-stakeholder-input` | human | Collapsible panel below the lanes. |
| Research figure accuracy | `requires-stakeholder-input` | human | Verified via web search (see Research Sources). Corrections: "near zero past 400 LOC" is unsupported, so the panel says "diminishes". "Local vs. global coherence" has no originator and is presented as a practitioner idiom. |
| Pickup wait formula | `requires-stakeholder-input` | human | `pendingLoc ÷ effectiveSpeed`. It equals the original formula for uniform PR sizes and stays correct for mixed sizes. |
| Headline ratio readout | `requires-stakeholder-input` | human | Yes, as the hero metric, computed live. |
| Time-scale display | `requires-stakeholder-input` | human | Elapsed work-hours readout plus a "1 s = 1 work hour" note. Kept in hours by the generation amendment. |
| Detection label | `requires-stakeholder-input` | human | "Defects caught". |
| Panel open or closed by default | `inferable` | inference | Collapsed, so the lanes stay above the fold during a demo. Check passed: the alternative (expanded) pushes the simulation below the fold on a projector, which conflicts with the "presenter-driven demo" intent. |
| Mixed PR sizes after a size change | `inferable` | inference | Queued PRs keep their size; review consumes them proportionally (Engine step 2). Check passed: the alternative (resizing queued PRs retroactively) would change pending PR counts without any generation or review, which contradicts AC9 and AC8. Applies unchanged to derived sizes. |
| Shared vs. separate reviewers | `inferable` | inference | Shared: the research brief describes the same humans reviewing both kinds of code. This supersedes the "lanes are independent" row for review capacity only. Generation and queues stay independent. |
| Background-tab throttling | `requires-stakeholder-input` | human | Auto-pause when the tab is hidden. |
| Extra metrics | `requires-stakeholder-input` | human | **Superseded:** the research amendment adds detection %, incidents, incidents per PR, and pickup wait. Charts and history graphs remain out of scope. |
| Generation unit | `requires-stakeholder-input` | human | Generation amendment: PRs per day, on an 8-hour work day. Elapsed time, pickup wait, and reviewer speed stay per hour. |
| Generation inputs and PR size | `requires-stakeholder-input` | human | Code written (LOC/hr) plus PRs per day; PR size is derived (LOC/hr × 8 ÷ PRs/day). Humans can raise PRs that span more than one day. |
| Source of AI PR size and frequency | `requires-stakeholder-input` | human | "Use Faros data as the source of truth about the impact of using AI on PR size and frequency": AI PR size = human × 1.51; AI default volume gives PRs per day = human × 1.162 (Faros PR merge rate +16.2%, verified 2026-10-12). Data from the stakeholder's vsm-workshop repo (about 6,500 LOC and 4 PRs per active day) was considered and set aside because it implies a 39× headline ratio; it is not mentioned in the UI. |
| AI lane controls | `requires-stakeholder-input` | human | AI keeps its own code-written slider, defaulting from Faros; its PRs per day is derived. A fully derived AI lane was considered; rejected because AI volume could then never exceed review capacity. |
| Team size | `requires-stakeholder-input` | human | One developer. No queue grows at the defaults; the presenter raises AI code written to show the bottleneck. A team-size slider was considered and rejected. Intent revised to match. |
| Human defaults | `requires-stakeholder-input` | human | 30 LOC/hr and 1 PR/day (240-LOC PRs), so the headline (3.65×) lands near Faros's 3× incidents per PR. 25 LOC/hr (5.0×) was considered. |
| Slider ranges | `requires-stakeholder-input` | human | Human code written 5–200 step 5; human PRs per day 0.25–4 step 0.25; AI code written per developer up to 2,000. |
| AI code-written default and step | `inferable` | inference | 53, step 1: the nearest whole value to the Faros-derived 52.6, so the default PR frequency (1.17/day) stays within one point of +16.2%. Alternative checked: 55 with step 5 gives +21% frequency, which departs from the stated source of truth. Minimum 5 matches the human slider so the Faros default sits inside the range. |
| Rounding of derived sizes | `inferable` | inference | The model uses unrounded sizes (362.4); displays round to whole LOC and AI PRs per day to two decimals. Alternative checked: rounding inside the model changes no displayed default and adds a second rounding rule; the counts already follow "model continuous, display floored". |
| AI default does not follow human changes | `inferable` | inference | The AI code-written slider holds its own value; only its default comes from Faros. Its PR size still follows the human PR size (AC24). Alternative checked: re-deriving AI volume on every human change would override the presenter's AI setting, contradicting AC5. |
| Info tips: which controls | `inferable` | inference | Every slider, including the warning threshold (stakeholder: "each slider"). Derived read-only values get no tip; their labels state the derivation. |
| Info tips: keyboard and dismissal | `requires-stakeholder-input` | human | A focusable info button; opens on hover or focus, Escape closes, hoverable and persistent (WCAG 1.4.13). Adds a Tab stop before each slider. |
| Info tips: one open at a time | `inferable` | inference | Hover and focus can target different buttons; showing two tips would overlap. Alternative checked: allowing several adds visual noise with no benefit during a demo. |
| Info tips with the model change in one spec | `inferable` | inference | The tips describe the new inputs, so they ship and are validated together. Not a scope violation. |
| Default demo shows small numbers | `inferable` | inference | At one developer, 10 s shows Deployed 1 in each lane. Accepted by the stakeholder's team-size answer; AC7 and AC7d cover the default and the raised-volume cases. |

## Research Sources

Verified by web search on 2026-10-12. The panel uses the **Panel wording** column verbatim or close to it, and never uses the wording marked "do not use".

| Claim | Source | Status | Panel wording |
| --- | --- | --- | --- |
| Cisco study size | SmartBear, "Cisco Systems / Collaborator" case study, <https://smartbear.com/resources/case-studies/cisco-systems-collaborator/> | Verified | "2,500 reviews of 3.2 million lines of code over 10 months" |
| 200–400 LOC limit; 500 LOC/hr; 70–90% detection | SmartBear, "Best Practices for Code Review," <https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/> | Verified, as SmartBear guidance drawn from its Cisco research | "Review no more than 200–400 LOC at a time; beyond 400 LOC the ability to find defects diminishes. 200–400 LOC over 60–90 minutes yields 70–90% defect discovery. Defect discovery drops significantly faster than 500 LOC/hour." **Do not use** "drops to near zero". |
| PR size +51%; PR merge rate +16.2%; incidents per PR ~3× | Faros AI, "AI Engineering Report Q2 2026: The Acceleration Whiplash," <https://faros.ai/research/ai-acceleration-whiplash> | Verified (merge rate added 2026-10-12) | "Across 22,000 developers in 4,000 teams, high AI adoption saw PR size +51%, PR merge rate +16.2%, and 3× incidents per PR (+242.7%), compared with low adoption." |
| AI PRs wait 4.6× longer; reviewed 2× faster | LinearB, "2026 Software Engineering Benchmarks Report," <https://linearb.io/blog/engineering-benchmarks-report> | Verified | "AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up (8.1M+ PRs, 4,800+ orgs)." |
| Local vs. global coherence | No documented originator. Example: Tian Pan, "The AI Code Review Inversion," 2026-05-07, <https://tianpan.co/blog/2026-05-07-ai-code-review-inversion-reviewing-machine-authored-code> | Practitioner idiom | Present as a practitioner observation ("AI code is often locally coherent but globally brittle"), linking Tian Pan's post as an example. Never attribute the concept to a named originator. |

**Model notes:**

- The sim's size-factor floor (0.05 above 400 LOC) is a modeling assumption for "diminishes". The panel must not describe it as a research finding.
- The AI lane's PR size (×1.51) and default volume (giving ×1.162 PRs per day) come from Faros. The human defaults are an assumption, chosen so the AI/human incidents-per-PR ratio (≈3.65×) sits close to Faros's +242.7% (≈3.43×).

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
- [x] Every gap/ambiguity finding is logged — inferable with rationale or resolved by human

**Verdict: PASS** (re-checked after the generation amendment)
