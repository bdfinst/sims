import { describe, expect, it } from 'vitest'
import { LANE_IDS, LANE_MODELS, SLIDERS } from './engine.js'
import {
  LANE_ORDER,
  LANE_PRESENTATION,
  SLIDER_PRESENTATION,
  TILE_CAPACITY,
  derivedFieldText,
  tileLayout,
} from './laneConfig.js'

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
    expect(SLIDER_PRESENTATION[settingKey]).toEqual(presentation)
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
