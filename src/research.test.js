import { describe, expect, it } from 'vitest'
import { MODEL_ASSUMPTIONS } from './engine.js'
import { FINDINGS, FINDING_KIND, assumptionsNote } from './research.js'

const FORBIDDEN_PHRASES = ['near zero', 'coined', 'originated']
const FAROS_URL = 'https://faros.ai/research/ai-acceleration-whiplash'

// Independent oracles: the spec's Research Sources "Panel wording" column, copied verbatim.
const PANEL_WORDING = [
  {
    url: 'https://smartbear.com/resources/case-studies/cisco-systems-collaborator/',
    wording: '2,500 reviews of 3.2 million lines of code over 10 months',
  },
  {
    url: 'https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/',
    wording:
      'Review no more than 200–400 LOC at a time; beyond 400 LOC the ability to find defects diminishes. 200–400 LOC over 60–90 minutes yields 70–90% defect discovery. Defect discovery drops significantly faster than 500 LOC/hour.',
  },
  {
    url: FAROS_URL,
    wording:
      'Across 22,000 developers in 4,000 teams, high AI adoption saw PR size +51%, PR merge rate +16.2%, and 3× incidents per PR (+242.7%), compared with low adoption.',
  },
  {
    url: 'https://linearb.io/blog/engineering-benchmarks-report',
    wording:
      'AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up (8.1M+ PRs, 4,800+ orgs).',
  },
]
// The practitioner observation: the spec's quoted paraphrase with the spec's punctuation (no period
// inside the quotes), presented as a practitioner observation (spec Research Sources; AC18). Neither
// the plan nor the spec gives the full sentence, so the "not a research finding" prefix is pinned too.
const PRACTITIONER_TEXT =
  'A practitioner observation, not a research finding: "AI code is often locally coherent but globally brittle".'
// The Faros incidents figure, as the spec's Panel wording and the Slice 7 scenario state it.
const FAROS_INCIDENTS_FIGURE = '+242.7%'

// Independent oracle: the Slice 7 scenario "Model assumptions and calibration are stated".
const ASSUMPTION_SCENARIO_PHRASES = [
  'These are modeling choices, not research findings',
  'the defect density (20 defects per 1,000 LOC)',
  "the base detection rate (0.8, picked from SmartBear's 70–90% range)",
  'the detection floors (0.05 for large PRs and 0.1 for fast reviewing)',
  'the curve thresholds (PR size 200 to 400 LOC, reviewer speed 500 to 1,000 LOC/hr)',
  'the human-lane defaults (30 LOC/hr and 1 PR per day)',
  "The AI lane's PR size (1.51× the human PR size) and default code written (1.162× the human PR merge rate) come from Faros",
  "The human defaults were chosen to land near Faros's +242.7% incidents per PR",
]

const findingFor = (url) => FINDINGS.find(({ source }) => source.url === url)

// The note as the panel renders it: the choices, then the calibration lead and its link text.
const renderedNote = ({ choices, calibration }) =>
  `${choices} ${calibration.lead} ${calibration.linkText}.`

describe('assumptionsNote', () => {
  it.each(ASSUMPTION_SCENARIO_PHRASES)('states "%s"', (phrase) => {
    expect(renderedNote(assumptionsNote())).toContain(phrase)
  })

  it('is built from the multipliers it is given, so it cannot drift from the model', () => {
    const { choices } = assumptionsNote({
      ...MODEL_ASSUMPTIONS,
      aiSizeMultiplier: 2.25,
      aiMergeRateMultiplier: 1.4,
    })
    expect(choices).toContain('PR size (2.25× the human PR size)')
    expect(choices).toContain('default code written (1.4× the human PR merge rate)')
    expect(choices).not.toContain('1.51')
    expect(choices).not.toContain('1.162')
  })

  it('is built from the human defaults it is given, with a plural for more than one PR', () => {
    const { choices } = assumptionsNote({
      ...MODEL_ASSUMPTIONS,
      humanDefaultLocPerHour: 1500,
      humanDefaultPrsPerDay: 2,
    })
    expect(choices).toContain('the human-lane defaults (1,500 LOC/hr and 2 PRs per day)')
  })

  it('links the calibration figure to Faros', () => {
    const { calibration } = assumptionsNote()
    expect(calibration.linkText).toBe("Faros's +242.7% incidents per PR")
    expect(calibration.url).toBe(FAROS_URL)
  })
})

describe('research data', () => {
  it('has five findings, each with a source link', () => {
    expect(FINDINGS).toHaveLength(5)
    for (const { id, source } of FINDINGS) {
      expect(source.url, `${id} url`).toMatch(/^https:\/\//)
      expect(source.label, `${id} label`).not.toBe('')
    }
  })

  it.each(PANEL_WORDING)('shows the spec Panel wording verbatim for $url', ({ url, wording }) => {
    expect(findingFor(url).text).toBe(wording)
  })

  it('shares one Faros figure between the finding and the calibration', () => {
    expect(findingFor(FAROS_URL).text).toContain(`(${FAROS_INCIDENTS_FIGURE})`)
    expect(assumptionsNote().calibration.linkText).toContain(FAROS_INCIDENTS_FIGURE)
  })

  it('marks exactly one finding as a practitioner observation, quoting the spec paraphrase', () => {
    const practitioner = FINDINGS.filter(({ kind }) => kind === FINDING_KIND.practitioner)
    expect(practitioner).toHaveLength(1)
    expect(practitioner[0].text).toBe(PRACTITIONER_TEXT)
  })

  it('never uses the unsupported or misattributing wording', () => {
    const { choices, calibration } = assumptionsNote()
    const everyText = [
      ...FINDINGS.map(({ text }) => text),
      choices,
      calibration.lead,
      calibration.linkText,
    ]
      .join(' ')
      .toLowerCase()
    for (const phrase of FORBIDDEN_PHRASES) expect(everyText).not.toContain(phrase)
  })
})
