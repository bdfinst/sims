import { describe, expect, it } from 'vitest'
import { LANE_MODELS } from './engine.js'
import { LANE_ORDER, LANE_PRESENTATION, TILE_CAPACITY, tileLayout } from './laneConfig.js'

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
