import {
  FAROS_INCIDENTS_PER_PR_INCREASE_PCT,
  FAROS_MERGE_RATE_INCREASE_PCT,
  FAROS_PR_SIZE_INCREASE_PCT,
  MODEL_ASSUMPTIONS,
  formatCount,
  formatLocPerHour,
  formatMultiplier,
} from './engine.js'

export const RESEARCH_TITLE = 'Research behind this simulation'

// The calibration target is quoted twice (the Faros finding and the assumptions note), so it is
// defined once.
const FAROS_URL = 'https://faros.ai/research/ai-acceleration-whiplash'
// The source of the 70–90% detection range, linked from its finding and from the assumptions note.
const SMARTBEAR_PRACTICES_URL =
  'https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/'
const FAROS_INCIDENTS_INCREASE = `+${FAROS_INCIDENTS_PER_PR_INCREASE_PCT}%`

// Whether a finding is published research or a practitioner observation (never attributed to a source).
export const FINDING_KIND = Object.freeze({ research: 'research', practitioner: 'practitioner' })

// FINDINGS is data: each text is the spec's Research Sources "Panel wording", copied verbatim; the
// practitioner observation is a quoted paraphrase with an example link, never an attributed source.
// Figures read from engine constants: the Faros finding's "+51%", "+16.2%", and "+242.7%"; the
// calibration link's "+242.7%"; and every number in the assumptions note's modeling choices except
// "70–90%" and "1,000" in "per 1,000 LOC". Every other figure, including the Faros "3×" (the
// source's own rounded phrase), is literal text.
export const FINDINGS = Object.freeze([
  Object.freeze({
    id: 'cisco-study',
    kind: FINDING_KIND.research,
    text: '2,500 reviews of 3.2 million lines of code over 10 months',
    source: Object.freeze({
      label: 'SmartBear, Cisco Systems / Collaborator case study',
      url: 'https://smartbear.com/resources/case-studies/cisco-systems-collaborator/',
    }),
  }),
  Object.freeze({
    id: 'review-limits',
    kind: FINDING_KIND.research,
    text: 'Review no more than 200–400 LOC at a time; beyond 400 LOC the ability to find defects diminishes. 200–400 LOC over 60–90 minutes yields 70–90% defect discovery. Defect discovery drops significantly faster than 500 LOC/hour.',
    source: Object.freeze({
      label: 'SmartBear, Best Practices for Code Review',
      url: SMARTBEAR_PRACTICES_URL,
    }),
  }),
  Object.freeze({
    id: 'faros-incidents',
    kind: FINDING_KIND.research,
    text: `Across 22,000 developers in 4,000 teams, high AI adoption saw PR size +${FAROS_PR_SIZE_INCREASE_PCT}%, PR merge rate +${FAROS_MERGE_RATE_INCREASE_PCT}%, and 3× incidents per PR (${FAROS_INCIDENTS_INCREASE}), compared with low adoption.`,
    source: Object.freeze({
      label: 'Faros AI, AI Engineering Report Q2 2026: The Acceleration Whiplash',
      url: FAROS_URL,
    }),
  }),
  Object.freeze({
    id: 'linearb-wait',
    kind: FINDING_KIND.research,
    text: 'AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up (8.1M+ PRs, 4,800+ orgs).',
    source: Object.freeze({
      label: 'LinearB, 2026 Software Engineering Benchmarks Report',
      url: 'https://linearb.io/blog/engineering-benchmarks-report',
    }),
  }),
  Object.freeze({
    id: 'local-vs-global',
    kind: FINDING_KIND.practitioner,
    text: 'A practitioner observation, not a research finding: "AI code is often locally coherent but globally brittle".',
    source: Object.freeze({
      label: 'Example: Tian Pan, The AI Code Review Inversion',
      url: 'https://tianpan.co/blog/2026-05-07-ai-code-review-inversion-reviewing-machine-authored-code',
    }),
  }),
])

const formatPrsPerDayPhrase = (prsPerDay) =>
  `${formatCount(prsPerDay)} ${prsPerDay === 1 ? 'PR' : 'PRs'} per day`

// The note as text and link segments ({ text, url }), so each sourced figure renders as a link to
// its source (AC18).
export const assumptionsNote = (assumptions = MODEL_ASSUMPTIONS) => [
  `Model assumptions. These are modeling choices, not research findings: the defect density (${assumptions.defectsPerKloc} defects per 1,000 LOC), the base detection rate (${assumptions.baseDetection}, picked from `,
  { text: "SmartBear's 70–90%", url: SMARTBEAR_PRACTICES_URL },
  ` range), the detection floors (${assumptions.sizeFloor} for large PRs and ${assumptions.speedFloor} for fast reviewing), the curve thresholds (PR size ${assumptions.sizeKnee} to ${assumptions.sizeWall} LOC, reviewer speed ${formatCount(assumptions.speedKnee)} to ${formatCount(assumptions.speedWall)} LOC/hr), and the human-lane defaults, an assumption (${formatLocPerHour(assumptions.humanDefaultLocPerHour)} and ${formatPrsPerDayPhrase(assumptions.humanDefaultPrsPerDay)}). The AI lane's PR size (${formatMultiplier(assumptions.aiSizeMultiplier)} the human PR size) and default volume (giving ${formatMultiplier(assumptions.aiPrsPerDayRatio)} the human PRs per day) `,
  { text: 'come from Faros', url: FAROS_URL },
  '. The human defaults were chosen to land near ',
  { text: `Faros's ${FAROS_INCIDENTS_INCREASE} incidents per PR`, url: FAROS_URL },
  '.',
]
