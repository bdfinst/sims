import { describe, expect, it } from 'vitest'
import { LANE_IDS, LANE_MODELS, SLIDERS } from './engine.js'
import {
  LANE_ORDER,
  LANE_PRESENTATION,
  SLIDER_PRESENTATION,
  TILE_CAPACITY,
  tileLayout,
} from './laneConfig.js'

// 22 PRs are queued after 1.2 s (the AI lane) and must each get a tile; 98 is the largest
// capacity the "exactly at capacity" scenario can reach (n - 1 pending after n ticks, up to tick 99).
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
    '%s lane shows its generation slider, and the skim slider only if skim applies',
    (laneId) => {
      const { genSetting, skimApplies } = LANE_MODELS[laneId]
      const { generationSliders, reviewSliders } = LANE_PRESENTATION[laneId]

      expect(generationSliders).toContain(genSetting)
      expect(reviewSliders.includes('skim')).toBe(skimApplies)
    },
  )
})

describe('slider presentation', () => {
  it.each(Object.keys(SLIDERS))('has a label, unit, and spoken unit for %s', (settingKey) => {
    const { label, unit, spokenUnit } = SLIDER_PRESENTATION[settingKey]
    expect([label, unit, spokenUnit].every((text) => typeof text === 'string' && text !== '')).toBe(
      true,
    )
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
  const rendered = ({ prefix, format, note }, value) => `${prefix} ${format(value)} ${note}`.trim()

  it('has the Human lane show its derived PR size', () => {
    const [sizeField] = LANE_PRESENTATION[LANE_IDS.human].derivedFields
    expect(rendered(sizeField, 240)).toBe('PR size 240 LOC (derived)')
  })

  it('has the AI lane show its PR size against the human one, then its PRs per day', () => {
    const [sizeField, prsPerDayField] = LANE_PRESENTATION[LANE_IDS.ai].derivedFields
    expect(rendered(sizeField, 362.4)).toBe('PR size 362 LOC (1.51× human)')
    expect(rendered(prsPerDayField, 1.17)).toBe('1.17 PRs/day (derived)')
  })

  it('reads each field from the laneParams value it names', () => {
    expect(
      LANE_ORDER.map((laneId) => LANE_PRESENTATION[laneId].derivedFields.map(({ param }) => param)),
    ).toEqual([['size'], ['size', 'prsPerDay']])
  })
})
