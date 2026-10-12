import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS,
  LANE_IDS,
  LANE_MODELS,
  SLIDERS,
  MS_PER_WORK_HOUR,
  TICK_MS,
  detection,
  emptyLane,
  floorShow,
  formatElapsedHours,
  formatLoc,
  formatPct,
  laneParams,
  sizeFactor,
  speedFactor,
  tick,
} from './engine.js'
import { shownCounts } from './testHelpers.js'

describe('laneParams at the default settings', () => {
  it('gives the Human lane its own generation rate, the base PR size, and the base reviewer speed', () => {
    expect(laneParams(DEFAULT_SETTINGS, LANE_MODELS[LANE_IDS.human])).toEqual({
      gen: 1,
      size: 250,
      effSpeed: 300,
    })
  })

  it('gives the AI lane its own generation rate, a 1.51x PR size, and a skim-multiplied speed', () => {
    expect(laneParams(DEFAULT_SETTINGS, LANE_MODELS[LANE_IDS.ai])).toEqual({
      gen: 20,
      size: 378,
      effSpeed: 600,
    })
  })
})

describe('laneParams after settings change', () => {
  it('derives AI size and speed from the new PR size and skim (302 LOC, 900 LOC/hr)', () => {
    const settings = { ...DEFAULT_SETTINGS, prSize: 200, skim: 3 }
    expect(laneParams(settings, LANE_MODELS[LANE_IDS.ai])).toMatchObject({
      size: 302,
      effSpeed: 900,
    })
  })

  it('ignores skim for the Human lane', () => {
    const settings = { ...DEFAULT_SETTINGS, skim: 3 }
    expect(laneParams(settings, LANE_MODELS[LANE_IDS.human]).effSpeed).toBe(300)
  })
})

describe('slider table', () => {
  it('defaults every setting to the spec State table value', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      humanGen: 1,
      aiGen: 20,
      prSize: 250,
      reviewerSpeed: 300,
      skim: 2,
      threshold: 15,
    })
  })

  it('keeps every default inside its own range', () => {
    Object.values(SLIDERS).forEach(({ min, max, defaultValue }) => {
      expect(defaultValue).toBeGreaterThanOrEqual(min)
      expect(defaultValue).toBeLessThanOrEqual(max)
    })
  })
})

const runTicks = (lane, params, count) =>
  Array.from({ length: count }).reduce((current) => tick(current, params), lane)

const defaultParams = (laneId) => laneParams(DEFAULT_SETTINGS, LANE_MODELS[laneId])

describe('tick at the default settings', () => {
  it('leaves the Human queue empty and deploys 10 PRs after 10 seconds', () => {
    const lane = runTicks(emptyLane(), defaultParams(LANE_IDS.human), 100)
    expect(shownCounts(lane)).toEqual([0, 10])
  })

  it('backs up 184 PRs in the AI queue and deploys 15 after 10 seconds', () => {
    const lane = runTicks(emptyLane(), defaultParams(LANE_IDS.ai), 100)
    expect(shownCounts(lane)).toEqual([184, 15])
  })

  it('holds 69,600 pending LOC in the AI queue after 10 seconds', () => {
    const lane = runTicks(emptyLane(), defaultParams(LANE_IDS.ai), 100)
    expect(Math.round(lane.pendingLoc)).toBe(69600)
  })
})

describe('tick accumulation at the default settings (detection still stubbed at 0)', () => {
  it.each([
    { laneId: LANE_IDS.human, reviewedLoc: 2500, escapedDefects: 50 },
    { laneId: LANE_IDS.ai, reviewedLoc: 6000, escapedDefects: 120 },
  ])(
    'the $laneId lane reviews $reviewedLoc LOC and lets $escapedDefects defects escape in 10 seconds',
    ({ laneId, reviewedLoc, escapedDefects }) => {
      const lane = runTicks(emptyLane(), defaultParams(laneId), 100)
      expect(lane.deployedLoc).toBeCloseTo(reviewedLoc, 6)
      expect(lane.escapedDefects).toBeCloseTo(escapedDefects, 6)
    },
  )
})

describe('a PR counts as deployed only when fully reviewed', () => {
  it.each([
    { ticks: 9, deployed: 0 },
    { ticks: 10, deployed: 1 },
  ])('shows Human Deployed $deployed after $ticks ticks', ({ ticks, deployed }) => {
    const lane = runTicks(emptyLane(), defaultParams(LANE_IDS.human), ticks)
    expect(floorShow(lane.deployedPrs)).toBe(deployed)
  })
})

describe('tick guards', () => {
  it('empties a queue whose review capacity exceeds it', () => {
    const backlog = { ...emptyLane(), pendingPrs: 0.5, pendingLoc: 125 }
    const lane = tick(backlog, { gen: 0, size: 250, effSpeed: 1500 })
    expect([lane.pendingPrs, lane.pendingLoc]).toEqual([0, 0])
  })

  it('clamps float drift so Pending PRs never goes below zero', () => {
    // (0.2 * 10.200000000000001) / 10.200000000000001 exceeds 0.2 by one rounding step,
    // so subtracting the reviewed share would leave about -2.8e-17 without the clamp.
    const drifting = { ...emptyLane(), pendingPrs: 0.2, pendingLoc: 10.200000000000001 }
    const lane = tick(drifting, { gen: 0, size: 250, effSpeed: 1000 })
    expect(lane.pendingPrs).toBe(0)
  })

  it('stays finite on an empty queue with no generation', () => {
    const lane = tick(emptyLane(), { gen: 0, size: 250, effSpeed: 300 })
    expect(lane).toEqual(emptyLane())
  })

  it('does not mutate the lane it was given', () => {
    const before = emptyLane()
    tick(before, defaultParams(LANE_IDS.ai))
    expect(before).toEqual(emptyLane())
  })
})

describe('floorShow', () => {
  it.each([
    { value: 9.9999999999, shown: 10 },
    { value: 0.9, shown: 0 },
    { value: 0, shown: 0 },
  ])('shows $shown for $value', ({ value, shown }) => {
    expect(floorShow(value)).toBe(shown)
  })
})

describe('time scale', () => {
  it('runs one tick every 100 ms at 1000 ms per work hour', () => {
    expect([MS_PER_WORK_HOUR, TICK_MS]).toEqual([1000, 100])
  })
})

describe('formatElapsedHours', () => {
  it.each([
    { ticks: 0, shown: '0.0' },
    { ticks: 30, shown: '3.0' },
    { ticks: 100, shown: '10.0' },
  ])('shows $shown for $ticks ticks', ({ ticks, shown }) => {
    expect(formatElapsedHours(ticks)).toBe(shown)
  })
})

describe('sizeFactor', () => {
  it.each([
    { size: 50, factor: 1 },
    { size: 200, factor: 1 },
    { size: 300, factor: 0.525 },
    { size: 400, factor: 0.05 },
    { size: 1000, factor: 0.05 },
  ])('is $factor for a $size LOC PR', ({ size, factor }) => {
    expect(sizeFactor(size)).toBeCloseTo(factor, 10)
  })

  it('starts falling just past the knee and stops just before the wall', () => {
    expect(sizeFactor(201)).toBeLessThan(1)
    expect(sizeFactor(399)).toBeGreaterThan(0.05)
  })
})

describe('speedFactor', () => {
  it.each([
    { speed: 100, factor: 1 },
    { speed: 500, factor: 1 },
    { speed: 750, factor: 0.55 },
    { speed: 1000, factor: 0.1 },
    { speed: 5000, factor: 0.1 },
  ])('is $factor at $speed LOC/hr', ({ speed, factor }) => {
    expect(speedFactor(speed)).toBeCloseTo(factor, 10)
  })

  it('starts falling just past the knee and stops just before the wall', () => {
    expect(speedFactor(501)).toBeLessThan(1)
    expect(speedFactor(999)).toBeGreaterThan(0.1)
  })
})

describe('Defects caught for a lane (detection x 100, rounded)', () => {
  const caughtPct = (overrides, laneId = LANE_IDS.human) => {
    const { size, effSpeed } = laneParams(
      { ...DEFAULT_SETTINGS, ...overrides },
      LANE_MODELS[laneId],
    )
    return Math.round(detection(size, effSpeed) * 100)
  }

  it.each([
    { prSize: 50, caught: 80 },
    { prSize: 200, caught: 80 },
    { prSize: 300, caught: 42 },
    { prSize: 400, caught: 4 },
    { prSize: 1000, caught: 4 },
  ])('Human at PR size $prSize catches $caught%', ({ prSize, caught }) => {
    expect(caughtPct({ prSize })).toBe(caught)
  })

  it.each([
    { reviewerSpeed: 500, caught: 80 },
    { reviewerSpeed: 750, caught: 44 },
    { reviewerSpeed: 900, caught: 22 },
    { reviewerSpeed: 1000, caught: 8 },
  ])(
    'Human at PR size 200 and $reviewerSpeed LOC/hr catches $caught%',
    ({ reviewerSpeed, caught }) => {
      expect(caughtPct({ prSize: 200, reviewerSpeed })).toBe(caught)
    },
  )

  it.each([
    { laneId: LANE_IDS.human, expected: 61 },
    { laneId: LANE_IDS.ai, expected: 10 },
  ])('catches $expected% in the $laneId lane at the defaults', ({ laneId, expected }) => {
    expect(caughtPct({}, laneId)).toBe(expected)
  })

  it.each([
    { skim: 3, caught: 3 },
    { skim: 1, caught: 12 },
  ])('AI at skim $skim catches $caught%', ({ skim, caught }) => {
    expect(caughtPct({ skim }, LANE_IDS.ai)).toBe(caught)
  })

  it('shows 6% for a drained queue (PR size 250 at 1000 LOC/hr)', () => {
    expect(caughtPct({ reviewerSpeed: 1000 })).toBe(6)
  })
})

describe('formatPct', () => {
  it.each([
    { share: 0.61, shown: '61%' },
    { share: 0.0346, shown: '3%' },
    { share: 0.125, shown: '13%' },
    { share: 0, shown: '0%' },
  ])('shows $shown for $share', ({ share, shown }) => {
    expect(formatPct(share)).toBe(shown)
  })
})

describe('formatLoc', () => {
  it.each([
    { loc: 0, shown: '0' },
    { loc: 999.9999999999, shown: '1,000' },
    { loc: 69600, shown: '69,600' },
    { loc: 4400.4, shown: '4,400' },
  ])('shows $shown for $loc', ({ loc, shown }) => {
    expect(formatLoc(loc)).toBe(shown)
  })
})
