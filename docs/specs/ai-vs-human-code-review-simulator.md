<!-- spec-version: 14.0.1 -->
# Spec: AI vs. Human Code Review Simulator

**Source:** `sim.spec.md` (validate mode), amended 2026-10-12 with the stakeholder's code-review research brief ("research brief" below). Criteria cite their source section; criteria without a source citation come from a stakeholder answer or a logged inference.

## Intent Description

Build an interactive, browser-based simulation that shows why AI code generation creates a review bottleneck. Two lanes run side by side. In the human lane, people write code and people review it. In the AI lane, AI generates code and people review it. Changesets flow from generation into a review queue and then to deployment. When generation outpaces review, the queue grows without bound. The AI lane makes this visible quickly: its queue turns red and overflows.

The simulation also shows the quality cost of the bottleneck. Human reviewers have fixed cognitive limits. Defect detection falls sharply once a review exceeds about 200–400 lines of code (LOC), or goes faster than about 500 LOC per hour. AI-generated PRs are larger, and reviewers skim them faster because the code looks clean. So more defects escape review and become production incidents. The simulator computes detection rate, escaped defects, incidents per PR, and pickup wait from those research-based rules. The ~3× incidents-per-PR effect emerges from the defaults rather than being hard-coded. A collapsible panel presents the research and its sources.

The audience is people watching a talk or a demo. The presenter changes generation rate, PR size, reviewer speed, and the skim effect live, and the effect on each queue and on incidents appears immediately.

## Architecture Specification

**Delivery**

- A Vite + React (JSX) project at the repo root. `npm run build` produces **one self-contained offline file**, `dist/index.html`, with all JS and CSS inlined by `vite-plugin-singlefile`. It needs no network at runtime and can be opened straight from disk or shared as a single file.
- Dependencies come from npm, not CDNs: `react`/`react-dom` 19, `lucide-react` for icons, and Tailwind CSS 4 through `@tailwindcss/vite`.
- Source layout:
  - `src/engine.js`: pure model, with no React or DOM: constants, the numeric lane model, the slider table, the detection curve, `tick`, and the formatters.
  - `src/reducer.js`: pure `reducer(state, action)` and `initialState` (`tick`, `start`, `pause`, `reset`, `setSetting`).
  - `src/laneConfig.js`: presentation only: labels, icon names, and class strings per lane, plus the tile layout.
  - `src/research.js`: findings data and the assumptions note.
  - `src/components/`: UI components.
  - `src/App.jsx`: `useReducer`, the tick-interval and visibility effects, and the page layout.
  - `src/main.jsx`: entry point.

**Components**

- `App`: owns the reducer state and the tick loop. Renders the header, the headline band, both lanes, and the research panel.
- `Header`: title, short description, a global warning-threshold slider, the Start/Pause and Reset buttons, the Running/Paused status, and the elapsed work hours.
- `HeadlineBand`: the AI ÷ Human incidents-per-PR ratio.
- `Lane`: one instance per lane, configured by props (label, icons, color scheme, slider ranges).
- `QueueBox`: shows the count, item tiles, the overflow indicator, and the warning state.
- `LaneMetrics`: per-lane deployed, defects caught, incidents, incidents per PR, and pickup wait (shown through `MetricValue`).
- `RateSlider`: a labeled range input.
- `ResearchPanel`: a collapsible section below the lanes with the research findings and their citations.
- `Icon`: maps an explicit set of icon names to named `lucide-react` imports and adds the `data-icon` hook.

**Time scale:** 1 simulated second = 1 work hour. Each 100ms tick = 0.1 work hour. All rates are per work hour.

**State** (from §3, plus stakeholder additions and the research amendment)

| Control | Default | Range | Step | Applies to |
|---|---|---|---|---|
| Human generation (PRs/hr) | 1 | 1–10 | 1 | Human lane |
| AI generation (PRs/hr) | 20 | 5–50 | 1 | AI lane |
| PR size (LOC) | 250 | 50–1000 | 10 | Human PR size. AI PR size = `round(size × 1.51)`, shown read-only (378 at default). |
| Reviewer speed (LOC/hr) | 300 | 100–1000 | 50 | The same human reviewers serve both lanes |
| AI skim multiplier | 2× | 1×–3× | 0.5× | AI lane effective reviewer speed = speed × skim (600 at default) |
| Warning threshold (pending PRs) | 15 | 5–50 | 1 | Both lanes |

- The original `humanReviewRate` and `aiReviewRate` sliders are **removed**. Review throughput is now derived: PRs/hr = effective speed ÷ PR size.
- `isRunning` (default `false`).
- Per lane: `pendingLoc`, `pendingPrs`, `deployedLoc`, `deployedPrs`, `escapedDefects`.

**Engine** (per lane, per tick)

1. Generate: add `genRate × 0.1` PRs and `genRate × 0.1 × prSize` LOC to pending.
2. Review: `reviewedLoc = min(pendingLoc, effectiveSpeed × 0.1)`. PRs reviewed = `pendingPrs × reviewedLoc / pendingLoc`; this handles queued PRs of mixed size after a size change. Move both to deployed. Clamp pending to ≥ 0.
3. Detection rate `d = 0.8 × sizeFactor(avgPendingPrSize) × speedFactor(effectiveSpeed)`, where:
   - `sizeFactor(L)` = 1 for L ≤ 200; falls linearly to 0.05 at L = 400; 0.05 for L > 400.
   - `speedFactor(R)` = 1 for R ≤ 500; falls linearly to 0.1 at R = 1000; 0.1 above.
4. Escape: `escapedDefects += reviewedLoc × 0.02 × (1 − d)`. Defect density is 20 per 1,000 LOC in both lanes. Each escaped defect counts as one incident.
5. Derived display values:
   - incidents per PR = `escapedDefects ÷ deployedPrs` ("—" when 0 deployed);
   - pickup wait (hours) = `pendingLoc ÷ effectiveSpeed`;
   - current detection % = `d` for the lane's current PR size and effective speed, labeled "Defects caught";
   - headline ratio = (AI escapedDefects ÷ AI deployedPrs) ÷ (Human escapedDefects ÷ Human deployedPrs), shown "—" until both lanes display Deployed ≥ 1;
   - elapsed work hours = ticks × 0.1.
- All counts show `Math.floor(x + 1e-9)`, so float sums of 0.1 display exactly (10, not 9).

**Engine**

- `tick(lane, params) → lane` is a pure function implementing steps 1–4 above (§4, §6).
- A `setInterval` of 100ms runs while `isRunning` is true. Each tick reads the current rates, so slider changes take effect on the next tick (§6).
- When the browser tab becomes hidden (`visibilitychange`), the simulation pauses automatically.

**Constraints**

- Dark theme. The layout is responsive down to phone width with no horizontal scroll.
- Nothing is saved: no `localStorage`, no backend.

## Acceptance Criteria

**Controls**

- AC1: On page load, the simulation is paused and all counts show 0. *(stakeholder: initial state)*
- AC2: Start begins the simulation. The same button then reads Pause, and pressing it stops all count changes. *(§2 "Start, Pause"; §3 `isRunning`)*
- AC3: Reset sets all counts and metrics (pending, deployed, incidents) to 0 and pauses the simulation. Slider values do not change. *(§2 "Reset"; stakeholder: reset behavior)*
- AC4: Each slider shows its current value with units, and uses the default, range, and step in the State table. *(§3; stakeholder: step; research amendment)*
- AC5: After a slider change while running, the next tick's displayed counts reflect the new value, and the simulation keeps running. *(§6 "Slider adjustments while running")*
- AC6: The warning-threshold slider (5–50, default 15) changes the threshold for both lanes. *(stakeholder: adjustable threshold)*

**Engine**

- AC7: With the default settings, after 10 seconds of running:
  - Human lane: pending 0, deployed 10, detection 61%, incidents 19, incidents per PR 1.95.
  - AI lane: pending 184, deployed 15, detection 10%, incidents 107, incidents per PR 6.79, pickup wait 116.0 h.
  *(Engine rules; stakeholder-approved model)*
- AC7a: At the defaults, AI incidents per PR is between 3× and 4× human incidents per PR. *(research brief: "incidents per PR tripled"; stakeholder: drive the math)*
- AC7b: Detection rate follows the size and speed factors:
  - at reviewer speed 300 and PR size ≤ 200, the human lane shows 80%;
  - at PR size ≥ 400, the human lane shows 4%;
  - at PR size 200 and reviewer speed 900 (speed factor 0.28), the human lane shows 22%.
  *(research brief: 200–400 LOC wall, 500 LOC/hr limit, 70–90% baseline)*
- AC7c: Changing PR size or reviewer speed while running changes the detection rate and the incident accrual from the next tick. *(§6; research amendment)*
- AC8: A queue never shows a negative value, even when the review rate is higher than the generation rate. *(§6 "Queue cannot be negative")*
- AC9: Deployed never decreases while the simulation runs. *(§4 review phase)*

**Display**

- AC10: Every count shows `Math.floor(x + 1e-9)` of its internal value. *(stakeholder: count display; exactness revision)*
- AC11: A queue box turns red and shows a warning icon when its displayed count is greater than `warningThreshold`. It returns to normal once the count drops back to the threshold or below. This applies to both lanes. *(§2 "turn red… >15"; stakeholder: both lanes)*
- AC12: Each queue box shows `min(displayed, C)` tiles, where the tile capacity C is between 22 and 98. When displayed > C, the box shows "+N more" with N = displayed − C. *(§5 "designed to overflow"; stakeholder: tiles)*
- AC13: The human lane uses blue/green colors with User and Eye icons. The AI lane uses purple with Bot and Eye icons, and red for its warning state. Each lane lays out generation → queue → review + deployed, left to right. *(§5)*
- AC14: The header shows the title "AI vs. Human Code Review Simulator", a one-sentence description, and the global buttons on the right. *(§1 Name, §5 Header)*
- AC15: The page has a dark theme and no horizontal scroll at 375px wide. On narrow screens, each lane stacks vertically. *(stakeholder: display)*
- AC16: Every slider has a visible text label, and you can operate every slider and button with the keyboard. *(inference: native inputs; see log)*
- AC17: Each lane shows pending LOC alongside pending PRs, and shows "Defects caught" %, incidents, incidents per PR, and pickup wait in hours. *(stakeholder: model all four findings; label "Defects caught")*
- AC21: A headline readout shows the live AI ÷ Human incidents-per-PR ratio (for example "3.48×"), computed from the simulation and never hard-coded. It shows "—" until both lanes *display* Deployed ≥ 1. *(stakeholder: hero metric)*
- AC22: An elapsed-time readout shows work hours ("10.0 work hours") with a "1 s = 1 work hour" note. It resets to 0.0 on Reset. *(stakeholder: time scale on screen)*
- AC18: A collapsible research panel below the lanes, collapsed by default, presents the five findings in Research Sources. It uses the Panel wording column verbatim, except the practitioner-observation finding, which uses its quoted paraphrase. Every figure links its source. *(stakeholder: collapsible panel; verification)*
- AC19: When the tab becomes hidden while running, the simulation pauses and the status shows "Paused". *(stakeholder: auto-pause)*
- AC20 (revised): `npm run build` produces `dist/index.html` with all JS and CSS inlined (no `<script src>`, stylesheet link, `modulepreload`, or file icon link). Opened from `file://`, it renders and runs and requests nothing but the document itself. The original CDN-failure criterion is withdrawn because there are no runtime CDNs. *(stakeholder: build step + offline single file)*

## Glossary

| Term | Definition | Status | Source |
| ------ | ------------ | -------- | -------- |
| Changeset / PR | One unit of code change that moves through generation → queue → deployed. It has a size in LOC. It is modeled as a continuous quantity and shown as a whole number. The UI says "PR". | `verified` | §1/§2; human chose floor display |
| LOC | Lines of code. Measures PR size and reviewer speed. | `verified` | Research brief |
| Reviewer speed | LOC a human reviewer reads per work hour. The AI lane's effective speed = speed × skim multiplier. | `verified` | Human approved the model |
| Skim multiplier | How much faster reviewers read AI-generated code, because it looks clean (LinearB "2× faster"). | `verified` | Human chose a 1×–3× slider |
| Detection rate ("Defects caught") | The share of defects in reviewed code that the review catches. The UI labels it "Defects caught". | `verified` | Human approved the model and the label |
| Incident | An escaped defect after deployment. One escaped defect = one incident. | `verified` | Human approved the model |
| Pickup wait | Hours a newly queued PR waits before review reaches it, given the current queue and throughput. | `verified` | Human approved the model |
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
| Slider step size | `requires-stakeholder-input` | human | Step 1 for all sliders. Alternative considered: step 5 for AI generation. |
| Theme and target screen | `requires-stakeholder-input` | human | Dark theme, responsive layout. |
| Warning compares the displayed or the internal value | `inferable` | inference | Compare the displayed (floored) value, so the color never contradicts the number shown. Check passed: the alternative (internal value, red while the box still shows "15") is ruled out by "exceeds… >15 items" being read against the visible count. |
| Lanes are independent | `inferable` | inference | Queues and generation are separate per lane. Reviewer *speed* is a shared setting, but each lane's review runs on its own (no capacity is split between lanes). |
| Tick increment is a fixed 0.1, not measured elapsed time | `inferable` | inference | §4 says "multiply… by 0.1 per tick". Check passed: the source rules out timing based on elapsed time. |
| Maximum visible tiles before "+N more" | `inferable` | inference | A visual tuning detail with no business meaning. Size it so the tiles fit the box at all breakpoints. Check: no plausible alternative changes observable behavior beyond AC12. |
| Accessibility (labels, keyboard) | `inferable` | inference | Native `<input type=range>` and `<button>` elements with labels give this at no extra cost. Check passed: no plausible developer would ship unlabeled sliders on purpose. |
| Header title text | `inferable` | inference | Use the §1 Name. The description sentence comes from the §1 Purpose. |
| CRUD for lanes, queues, and rates | `inferable` | inference | The model is in memory only. Changesets are counts, not records. Create = the generation tick; Update = review tick or slider change; Delete = Reset (AC3); Read = always visible. Nothing is saved (no `localStorage`). |
| Authentication / authorization | `inferable` | inference | Not applicable: a static, single-user demo page with no backend. |
| Audit / logging | `inferable` | inference | Not applicable: there is no state that must be recorded. |
| Dependency failure (CDN unavailable) | `requires-stakeholder-input` | human | **Withdrawn 2026-10-12:** with no runtime CDNs, AC20 and the loading message are dropped. |
| Internal number representation | `requires-stakeholder-input` | human | Human chose exact display (10, not 9.999… → 9). Integer tenths was the original mechanism. **Revised (inference):** reviewed PRs = pending PRs × reviewed LOC ÷ pending LOC, which is not integer, so exactness now comes from `Math.floor(x + 1e-9)`. Same observable behavior. |
| Research-driven model (sizes, curves, density, defaults) | `requires-stakeholder-input` | human | Approved as proposed. Defect density of 20/KLOC is an assumption, not from the research. The 0.05 and 0.1 floors stand in for "near zero". |
| Review-rate sliders | `requires-stakeholder-input` | human | Replaced by one shared reviewer-speed slider (LOC/hr); throughput is derived. |
| Skim multiplier control | `requires-stakeholder-input` | human | Slider 1×–3×, step 0.5×, default 2×. |
| Time scale | `requires-stakeholder-input` | human | 1 sim second = 1 work hour. |
| Research presentation | `requires-stakeholder-input` | human | Collapsible panel below the lanes. |
| Research figure accuracy | `requires-stakeholder-input` | human | Verified via web search (see Research Sources). Corrections: "near zero past 400 LOC" is unsupported, so the panel says "diminishes". "Local vs. global coherence" has no originator and is presented as a practitioner idiom. |
| Pickup wait formula | `requires-stakeholder-input` | human | `pendingLoc ÷ effectiveSpeed`. It equals the original formula for uniform PR sizes and stays correct for mixed sizes. |
| Headline ratio readout | `requires-stakeholder-input` | human | Yes, as the hero metric, computed live. |
| Time-scale display | `requires-stakeholder-input` | human | Elapsed work-hours readout plus a "1 s = 1 work hour" note. |
| Detection label | `requires-stakeholder-input` | human | "Defects caught". |
| Panel open or closed by default | `inferable` | inference | Collapsed, so the lanes stay above the fold during a demo. Check passed: the alternative (expanded) pushes the simulation below the fold on a projector, which conflicts with the "presenter-driven demo" intent. |
| Mixed PR sizes after a size change | `inferable` | inference | Queued PRs keep their size; review consumes them proportionally (Engine step 2). Check passed: the alternative (resizing queued PRs retroactively) would change pending PR counts without any generation or review, which contradicts AC9 and AC8. |
| Shared vs. separate reviewers | `inferable` | inference | Shared: the research brief describes the same humans reviewing both kinds of code. This supersedes the "lanes are independent" row for review capacity only. Generation and queues stay independent. |
| Background-tab throttling | `requires-stakeholder-input` | human | Auto-pause when the tab is hidden. |
| Extra metrics | `requires-stakeholder-input` | human | **Superseded:** the research amendment adds detection %, incidents, incidents per PR, and pickup wait. Charts and history graphs remain out of scope. |

## Research Sources

Verified by web search on 2026-10-12. The panel uses the **Panel wording** column verbatim or close to it, and never uses the wording marked "do not use".

| Claim | Source | Status | Panel wording |
|---|---|---|---|
| Cisco study size | SmartBear, "Cisco Systems / Collaborator" case study, https://smartbear.com/resources/case-studies/cisco-systems-collaborator/ | Verified | "2,500 reviews of 3.2 million lines of code over 10 months" |
| 200–400 LOC limit; 500 LOC/hr; 70–90% detection | SmartBear, "Best Practices for Code Review," https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/ | Verified, as SmartBear guidance drawn from its Cisco research | "Review no more than 200–400 LOC at a time; beyond 400 LOC the ability to find defects diminishes. 200–400 LOC over 60–90 minutes yields 70–90% defect discovery. Defect discovery drops significantly faster than 500 LOC/hour." **Do not use** "drops to near zero". |
| PR size +51%; incidents per PR ~3× | Faros AI, "AI Engineering Report Q2 2026: The Acceleration Whiplash," https://faros.ai/research/ai-acceleration-whiplash | Verified | "Across 22,000 developers in 4,000 teams, high AI adoption saw PR size +51% and 3× incidents per PR (+242.7%), compared with low adoption." |
| AI PRs wait 4.6× longer; reviewed 2× faster | LinearB, "2026 Software Engineering Benchmarks Report," https://linearb.io/blog/engineering-benchmarks-report | Verified | "AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up (8.1M+ PRs, 4,800+ orgs)." |
| Local vs. global coherence | No documented originator. Example: Tian Pan, "The AI Code Review Inversion," 2026-05-07, https://tianpan.co/blog/2026-05-07-ai-code-review-inversion-reviewing-machine-authored-code | Practitioner idiom | Present as a practitioner observation ("AI code is often locally coherent but globally brittle"), linking Tian Pan's post as an example. Never attribute the concept to a named originator. |

**Model notes:**
- The sim's size-factor floor (0.05 above 400 LOC) is a modeling assumption for "diminishes". The panel must not describe it as a research finding.
- At the defaults, the sim's AI/human incidents-per-PR ratio (≈3.48×) sits close to Faros's +242.7% (≈3.43×).

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
- [x] Every gap/ambiguity finding is logged — inferable with rationale or resolved by human

**Verdict: PASS**
