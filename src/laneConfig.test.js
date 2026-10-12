import { describe, expect, it } from 'vitest'
import {
  FAROS_MERGE_RATE_INCREASE_PCT,
  FAROS_PR_SIZE_INCREASE_PCT,
  LANE_IDS,
  LANE_MODELS,
  SLIDERS,
  WORK_HOURS_PER_DAY,
} from './engine.js'
import {
  LANE_ORDER,
  LANE_PRESENTATION,
  SLIDER_PRESENTATION,
  TILE_CAPACITY,
  derivedFieldText,
  sliderInfoTexts,
  tileLayout,
} from './laneConfig.js'
import { FINDINGS } from './research.js'

// 22 is the busy-AI queue at 5.7 s, and each of those PRs must get a tile. With the exact AI preset
// the queue is n pending after n ticks, up to 100, so 98 is the largest capacity C for which both C
// and C + 1 pending can be shown.
const MIN_TILE_CAPACITY = 22
const MAX_TILE_CAPACITY = 98

describe('TILE_CAPACITY', () => {
  it('is between the smallest and largest capacity the scenarios allow', () => {
    expect(TILE_CAPACITY).toBeGreaterThanOrEqual(MIN_TILE_CAPACITY)
    expect(TILE_CAPACITY).toBeLessThanOrEqual(MAX_TILE_CAPACITY)
  })
})

describe('tileLayout', () => {
  const CAPACITY = 5

  it.each([
    { displayed: 0, tileCount: 0, overflowCount: 0 },
    { displayed: CAPACITY - 1, tileCount: CAPACITY - 1, overflowCount: 0 },
    { displayed: CAPACITY, tileCount: CAPACITY, overflowCount: 0 },
    { displayed: CAPACITY + 1, tileCount: CAPACITY, overflowCount: 1 },
    { displayed: 184, tileCount: CAPACITY, overflowCount: 184 - CAPACITY },
  ])(
    'draws $tileCount tiles and $overflowCount more for $displayed pending PRs at capacity 5',
    ({ displayed, tileCount, overflowCount }) => {
      expect(tileLayout(displayed, CAPACITY)).toEqual({ tileCount, overflowCount })
    },
  )
})

// The lane <-> settings link is declared twice (engine LANE_MODELS, laneConfig sliders); they must agree.
describe('lane presentation agrees with the lane model', () => {
  it.each(LANE_ORDER)(
    '%s lane shows its code-written slider, and the skim slider only if skim applies',
    (laneId) => {
      const { locSetting, skimApplies } = LANE_MODELS[laneId]
      const { generationSliders, reviewSliders } = LANE_PRESENTATION[laneId]

      expect(generationSliders).toContain(locSetting)
      expect(reviewSliders.includes('skim')).toBe(skimApplies)
    },
  )

  it('puts the PRs-per-day slider in the Human lane only, after its code-written slider', () => {
    expect(LANE_PRESENTATION[LANE_IDS.human].generationSliders).toEqual([
      'humanLocPerHour',
      'humanPrsPerDay',
    ])
    expect(LANE_PRESENTATION[LANE_IDS.ai].generationSliders).toEqual(['aiLocPerHour'])
  })

  it('shows every slider exactly once across the lanes', () => {
    const shown = LANE_ORDER.flatMap((laneId) => [
      ...LANE_PRESENTATION[laneId].generationSliders,
      ...LANE_PRESENTATION[laneId].reviewSliders,
    ])
    expect([...shown].sort()).toEqual(
      Object.keys(SLIDERS)
        .filter((key) => key !== 'threshold')
        .sort(),
    )
  })
})

describe('slider presentation', () => {
  it.each(Object.keys(SLIDERS))('has a label, unit, and spoken unit for %s', (settingKey) => {
    const nonEmptyText = expect.stringMatching(/./)
    expect(SLIDER_PRESENTATION[settingKey]).toMatchObject({
      label: nonEmptyText,
      unit: nonEmptyText,
      spokenUnit: nonEmptyText,
    })
  })

  it.each([
    {
      settingKey: 'humanLocPerHour',
      label: 'Human code written (LOC/hr)',
      unit: ' LOC/hr',
      spokenUnit: 'lines of code per hour',
    },
    {
      settingKey: 'humanPrsPerDay',
      label: 'Human PRs per day',
      unit: ' PRs/day',
      spokenUnit: 'PRs per day',
    },
    {
      settingKey: 'aiLocPerHour',
      label: 'AI code written (LOC/hr)',
      unit: ' LOC/hr',
      spokenUnit: 'lines of code per hour',
    },
  ])('words $settingKey as "$label"', ({ settingKey, ...presentation }) => {
    expect(SLIDER_PRESENTATION[settingKey]).toMatchObject(presentation)
  })
})

// Plan, "Info tips": each slider's tip text, unit, and lanes, copied here as independent oracles.
const TIP_ORACLES = [
  {
    settingKey: 'threshold',
    unitName: 'PRs',
    lanes: 'both lanes',
    info: 'A Pending Review box turns red when its count is above this many PRs, in both lanes.',
  },
  {
    settingKey: 'humanLocPerHour',
    unitName: 'LOC/hr',
    lanes: 'human lane',
    info: 'How many lines of code the human lane writes, in LOC/hr. With Human PRs per day, it sets the human PR size. AI PRs are 1.51× that size (Faros: PR size +51%).',
  },
  {
    settingKey: 'humanPrsPerDay',
    unitName: 'PRs/day',
    lanes: 'human lane',
    info: 'How many PRs the human lane opens per 8-hour work day, in PRs/day. Below 1, a PR spans more than one day. Human PR size = LOC/hr × 8 ÷ PRs/day.',
  },
  {
    settingKey: 'aiLocPerHour',
    unitName: 'LOC/hr',
    lanes: 'AI lane',
    info: "How many lines of code the AI lane generates, in LOC/hr. The AI queue grows once this exceeds the AI lane's effective review speed. Default: the human default scaled by Faros (PR size +51%, PR merge rate +16.2%).",
  },
  {
    settingKey: 'reviewerSpeed',
    unitName: 'LOC/hr',
    lanes: 'both lanes',
    info: 'How many lines of code a reviewer reads, in LOC/hr, in both lanes. Defect discovery drops significantly faster than 500 LOC/hour (SmartBear).',
  },
  {
    settingKey: 'skim',
    unitName: '×',
    lanes: 'AI lane',
    info: 'How much faster reviewers read AI-generated code (×) in the AI lane: effective speed is reviewer speed × this value. AI PRs are reviewed 2× faster once picked up (LinearB).',
  },
]
const QUOTED_FINDINGS = [
  {
    settingKey: 'reviewerSpeed',
    findingId: 'review-limits',
    source: 'SmartBear',
    clause: 'Defect discovery drops significantly faster than 500 LOC/hour',
  },
  {
    settingKey: 'skim',
    findingId: 'linearb-wait',
    source: 'LinearB',
    clause: 'reviewed 2× faster once picked up',
  },
]
const MAX_LEAD_SENTENCE_WORDS = 25
const UNSUPPORTED_WORDING = ['near zero', 'coined', 'originated']
const leadSentence = (text) => text.split(/(?<=\.)\s/)[0]
const wordCount = (sentence) => sentence.split(/\s+/).length

describe('slider info tips', () => {
  it('covers every slider', () => {
    expect(TIP_ORACLES.map(({ settingKey }) => settingKey).sort()).toEqual(
      Object.keys(SLIDERS).sort(),
    )
  })

  // The oracle pins each tip word for word, so the plan's rules on unit, lanes, and unsupported
  // wording are checked once here, against the pinned text.
  it.each(TIP_ORACLES)(
    "gives $settingKey the plan's tip text, unit, and lanes, naming both and no unsupported wording",
    ({ settingKey, ...tip }) => {
      expect(SLIDER_PRESENTATION[settingKey]).toMatchObject(tip)
      expect(tip.info).toContain(tip.unitName)
      expect(tip.info).toContain(tip.lanes)
      expect(UNSUPPORTED_WORDING.filter((phrase) => tip.info.includes(phrase))).toEqual([])
    },
  )

  it.each(Object.keys(SLIDERS))(
    `leads the %s tip with a sentence of at most ${MAX_LEAD_SENTENCE_WORDS} words`,
    (settingKey) => {
      const lead = leadSentence(SLIDER_PRESENTATION[settingKey].info)
      expect(lead).toMatch(/\.$/)
      expect(wordCount(lead)).toBeLessThanOrEqual(MAX_LEAD_SENTENCE_WORDS)
    },
  )

  it('takes every "8" from WORK_HOURS_PER_DAY, so another work day leaves no "8" in any tip', () => {
    // Faros figures with no "8" in them, so any "8" left can only be a hard-coded work day.
    const texts = sliderInfoTexts({
      workHoursPerDay: 7,
      prSizeIncreasePct: 60,
      prSizeMultiplier: 1.6,
      mergeRateIncreasePct: 20.5,
    })
    expect(Object.values(texts).filter((text) => text.includes('8'))).toEqual([])
    expect(texts.humanPrsPerDay).toContain('per 7-hour work day')
    expect(texts.humanPrsPerDay).toContain('LOC/hr × 7 ÷ PRs/day')
  })

  // Each clause appears in both a tip and a research-panel finding; this keeps the copies in step.
  it.each(QUOTED_FINDINGS)(
    'quotes the $findingId finding word for word in the $settingKey tip',
    ({ settingKey, findingId, source, clause }) => {
      const finding = FINDINGS.find(({ id }) => id === findingId)
      expect(SLIDER_PRESENTATION[settingKey].info).toContain(`${clause} (${source})`)
      expect(finding.text).toContain(clause)
      expect(finding.source.label).toContain(source)
    },
  )

  it("quotes the engine's Faros constants in the human and AI tips", () => {
    const { humanLocPerHour, aiLocPerHour } = SLIDER_PRESENTATION
    expect(humanLocPerHour.info).toContain(`PR size +${FAROS_PR_SIZE_INCREASE_PCT}%`)
    expect(humanLocPerHour.info).toContain('1.51×')
    expect(aiLocPerHour.info).toContain(`PR size +${FAROS_PR_SIZE_INCREASE_PCT}%`)
    expect(aiLocPerHour.info).toContain(`PR merge rate +${FAROS_MERGE_RATE_INCREASE_PCT}%`)
  })

  it('reflects other Faros figures when built from them', () => {
    const texts = sliderInfoTexts({
      workHoursPerDay: WORK_HOURS_PER_DAY,
      prSizeIncreasePct: 60,
      prSizeMultiplier: 1.6,
      mergeRateIncreasePct: 20.5,
    })
    expect(texts.humanLocPerHour).toContain('AI PRs are 1.6× that size (Faros: PR size +60%)')
    expect(texts.aiLocPerHour).toContain('(PR size +60%, PR merge rate +20.5%)')
  })
})

describe('lane derived fields', () => {
  const textFor = (laneId, fieldIndex, params) =>
    derivedFieldText(LANE_PRESENTATION[laneId].derivedFields[fieldIndex], params)

  it('has the Human lane show its derived PR size', () => {
    expect(textFor(LANE_IDS.human, 0, { size: 240 })).toBe('PR size 240 LOC (derived)')
  })

  it('has the AI lane show its PR size against the human one, then its PRs per day', () => {
    expect(textFor(LANE_IDS.ai, 0, { size: 362.4 })).toBe('PR size 362 LOC (1.51× human)')
    expect(textFor(LANE_IDS.ai, 1, { prsPerDay: 1.17 })).toBe('1.17 PRs/day (derived)')
  })

  it('has the AI lane show its effective speed, with thousands separators', () => {
    expect(textFor(LANE_IDS.ai, 2, { effSpeed: 600 })).toBe('Effective speed 600 LOC/hr (derived)')
    expect(textFor(LANE_IDS.ai, 2, { effSpeed: 3000 })).toBe(
      'Effective speed 3,000 LOC/hr (derived)',
    )
  })

  it('reads each field from the laneParams value it names', () => {
    expect(
      LANE_ORDER.map((laneId) =>
        LANE_PRESENTATION[laneId].derivedFields.map(({ paramKey }) => paramKey),
      ),
    ).toEqual([['size'], ['size', 'prsPerDay', 'effSpeed']])
  })

  it('rounds sizes to whole LOC with thousands separators and PRs per day to two decimals', () => {
    expect(textFor(LANE_IDS.ai, 0, { size: 1449.6 })).toBe('PR size 1,450 LOC (1.51× human)')
    expect(textFor(LANE_IDS.ai, 1, { prsPerDay: 44.15 })).toBe('44.15 PRs/day (derived)')
  })
})
