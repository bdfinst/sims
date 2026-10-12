import { MODEL_ASSUMPTIONS } from './engine.js'

// Data only. The text is the spec's Research Sources "Panel wording", copied verbatim; the
// practitioner observation is a quoted paraphrase with an example link, never an attributed source.
export const RESEARCH_TITLE = 'Research behind this simulation'

export const FINDINGS = Object.freeze([
  Object.freeze({
    id: 'cisco-study',
    text: '2,500 reviews of 3.2 million lines of code over 10 months',
    source: Object.freeze({
      label: 'SmartBear, Cisco Systems / Collaborator case study',
      url: 'https://smartbear.com/resources/case-studies/cisco-systems-collaborator/',
    }),
  }),
  Object.freeze({
    id: 'review-limits',
    text: 'Review no more than 200–400 LOC at a time; beyond 400 LOC the ability to find defects diminishes. 200–400 LOC over 60–90 minutes yields 70–90% defect discovery. Defect discovery drops significantly faster than 500 LOC/hour.',
    source: Object.freeze({
      label: 'SmartBear, Best Practices for Code Review',
      url: 'https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/',
    }),
  }),
  Object.freeze({
    id: 'faros-incidents',
    text: 'Across 22,000 developers in 4,000 teams, high AI adoption saw PR size +51% and 3× incidents per PR (+242.7%), compared with low adoption.',
    source: Object.freeze({
      label: 'Faros AI, AI Engineering Report Q2 2026: The Acceleration Whiplash',
      url: 'https://faros.ai/research/ai-acceleration-whiplash',
    }),
  }),
  Object.freeze({
    id: 'linearb-wait',
    text: 'AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up (8.1M+ PRs, 4,800+ orgs).',
    source: Object.freeze({
      label: 'LinearB, 2026 Software Engineering Benchmarks Report',
      url: 'https://linearb.io/blog/engineering-benchmarks-report',
    }),
  }),
  Object.freeze({
    id: 'local-vs-global',
    text: 'A practitioner observation, not a research finding: "AI code is often locally coherent but globally brittle."',
    source: Object.freeze({
      label: 'Example: Tian Pan, The AI Code Review Inversion',
      url: 'https://tianpan.co/blog/2026-05-07-ai-code-review-inversion-reviewing-machine-authored-code',
    }),
  }),
])

const format = (number) => number.toLocaleString('en-US')

export const assumptionsNote = (assumptions = MODEL_ASSUMPTIONS) =>
  `Model assumptions. These are modeling choices, not research findings: the defect density (${assumptions.defectsPerKloc} defects per 1,000 LOC), the detection floors (${assumptions.sizeFloor} for large PRs and ${assumptions.speedFloor} for fast reviewing), the curve knees and walls (PR size ${assumptions.sizeKnee} to ${assumptions.sizeWall} LOC, reviewer speed ${format(assumptions.speedKnee)} to ${format(assumptions.speedWall)} LOC/hr), and the ${assumptions.aiSizeMultiplier} size multiplier for AI PRs. The defaults were calibrated so the AI lane lands near Faros's +242.7% incidents per PR.`
