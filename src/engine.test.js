import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS,
  LANE_IDS,
  LANE_MODELS,
  NO_VALUE,
  SLIDERS,
  detection,
  displayedDeployed,
  displayedPending,
  emptyLane,
  floorShow,
  formatDefectsCaught,
  formatElapsedHours,
  formatHeadlineRatio,
  formatIncidentsPerPr,
  formatLoc,
  formatPct,
  formatPickupWaitHours,
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

const TEN_SECONDS_IN_TICKS = 100
const ONE_SECOND_IN_TICKS = 10
const OVERSIZED_PR = 400

const runTicks = (lane, params, count) =>
  Array.from({ length: count }).reduce((current) => tick(current, params), lane)

const paramsFor = (laneId, overrides = {}) =>
  laneParams({ ...DEFAULT_SETTINGS, ...overrides }, LANE_MODELS[laneId])

const defaultParams = (laneId) => paramsFor(laneId)

const afterDefaultRun = (laneId) =>
  runTicks(emptyLane(), defaultParams(laneId), TEN_SECONDS_IN_TICKS)

const laneWithTotals = (deployedPrs, escapedDefects) => ({
  ...emptyLane(),
  deployedPrs,
  escapedDefects,
})

describe('tick at the default settings', () => {
  it('leaves the Human queue empty and deploys 10 PRs after 10 seconds', () => {
    expect(shownCounts(afterDefaultRun(LANE_IDS.human))).toEqual([0, 10])
  })

  it('backs up 184 PRs in the AI queue and deploys 15 after 10 seconds', () => {
    expect(shownCounts(afterDefaultRun(LANE_IDS.ai))).toEqual([184, 15])
  })

  it('holds 69,600 pending LOC in the AI queue after 10 seconds', () => {
    expect(formatLoc(afterDefaultRun(LANE_IDS.ai).pendingLoc)).toBe('69,600')
  })
})

describe('displayed counts', () => {
  it('floor the internal PR counts, absorbing float drift', () => {
    const lane = { ...emptyLane(), pendingPrs: 17.6, deployedPrs: 9.9999999999 }
    expect([displayedPending(lane), displayedDeployed(lane)]).toEqual([17, 10])
  })
})

describe('escape accrual at the default settings (10 seconds)', () => {
  // escaped = reviewed LOC x 0.02 x (1 - detection); Human detection 0.61, AI about 0.1014.
  it('lets 19.5 defects escape from the Human lane: 2500 x 0.02 x 0.39', () => {
    expect(afterDefaultRun(LANE_IDS.human).escapedDefects).toBeCloseTo(19.5, 6)
  })

  it('lets 107.84 defects escape from the AI lane, over 15.87 internal deployed PRs', () => {
    const ai = afterDefaultRun(LANE_IDS.ai)
    expect(ai.escapedDefects).toBeCloseTo(107.84, 2)
    expect(ai.deployedPrs).toBeCloseTo(15.87, 2)
  })

  it('shows Incidents 19 and 107 once floored', () => {
    const human = afterDefaultRun(LANE_IDS.human)
    const ai = afterDefaultRun(LANE_IDS.ai)
    expect([floorShow(human.escapedDefects), floorShow(ai.escapedDefects)]).toEqual([19, 107])
  })

  it('shows Human Incidents per PR 1.95', () => {
    expect(formatIncidentsPerPr(afterDefaultRun(LANE_IDS.human))).toBe('1.95')
  })

  it('shows Human Incidents 57 and 7.68 per PR when PR size is 400', () => {
    const human = runTicks(
      emptyLane(),
      paramsFor(LANE_IDS.human, { prSize: OVERSIZED_PR }),
      TEN_SECONDS_IN_TICKS,
    )
    expect([floorShow(human.escapedDefects), formatIncidentsPerPr(human)]).toEqual([57, '7.68'])
  })

  it('shows Human Incidents 53 and 6.94 per PR when PR size becomes 400 after 1 second', () => {
    const afterOneSecond = runTicks(emptyLane(), defaultParams(LANE_IDS.human), ONE_SECOND_IN_TICKS)
    const human = runTicks(
      afterOneSecond,
      paramsFor(LANE_IDS.human, { prSize: OVERSIZED_PR }),
      TEN_SECONDS_IN_TICKS - ONE_SECOND_IN_TICKS,
    )
    expect([floorShow(human.escapedDefects), formatIncidentsPerPr(human)]).toEqual([53, '6.94'])
  })
})

describe('formatIncidentsPerPr', () => {
  it('divides by internal Deployed, not the floored count (107.84 / 15.87, not 107 / 15)', () => {
    expect(formatIncidentsPerPr(afterDefaultRun(LANE_IDS.ai))).toBe('6.79')
    expect(formatIncidentsPerPr(laneWithTotals(15, 107))).toBe('7.13')
  })

  it('is blank while the displayed Deployed is 0 (0.9999 PRs)', () => {
    expect(formatIncidentsPerPr(laneWithTotals(0.9999, 1.755))).toBe(NO_VALUE)
  })

  it('shows a value from exactly 1 deployed PR (displayed Deployed 1)', () => {
    expect(formatIncidentsPerPr(laneWithTotals(1, 1.95))).toBe('1.95')
  })

  it('treats float drift just under 1 as 1 deployed PR', () => {
    expect(formatIncidentsPerPr(laneWithTotals(0.9999999999999999, 1.95))).toBe('1.95')
  })

  it('is blank for an empty lane, never NaN or Infinity', () => {
    expect(formatIncidentsPerPr(emptyLane())).toBe(NO_VALUE)
  })
})

describe('formatHeadlineRatio', () => {
  it('is the AI over Human incidents per PR: 3.48x at the defaults', () => {
    expect(formatHeadlineRatio(afterDefaultRun(LANE_IDS.ai), afterDefaultRun(LANE_IDS.human))).toBe(
      '3.48×',
    )
  })

  it('is blank until the Human lane displays Deployed 1', () => {
    expect(formatHeadlineRatio(laneWithTotals(5, 30), laneWithTotals(0.9, 1.7))).toBe(NO_VALUE)
  })

  it('is blank until the AI lane displays Deployed 1', () => {
    expect(formatHeadlineRatio(laneWithTotals(0.9, 6), laneWithTotals(5, 10))).toBe(NO_VALUE)
  })

  it('is blank when the Human lane has no incidents yet (no division by zero)', () => {
    expect(formatHeadlineRatio(laneWithTotals(5, 30), laneWithTotals(5, 0))).toBe(NO_VALUE)
  })

  it('is blank when neither lane has incidents (0 / 0 is not a number)', () => {
    expect(formatHeadlineRatio(laneWithTotals(5, 0), laneWithTotals(5, 0))).toBe(NO_VALUE)
  })
})

describe('formatPickupWaitHours', () => {
  it.each([
    { pendingLoc: 69600, effSpeed: 600, shown: '116.0' },
    { pendingLoc: 0, effSpeed: 300, shown: '0.0' },
    { pendingLoc: 4400, effSpeed: 300, shown: '14.7' },
  ])(
    'shows $shown h for $pendingLoc LOC at $effSpeed LOC/hr',
    ({ pendingLoc, effSpeed, shown }) => {
      expect(formatPickupWaitHours({ ...emptyLane(), pendingLoc }, { effSpeed })).toBe(shown)
    },
  )
})

describe('a PR counts as deployed only when fully reviewed', () => {
  it.each([
    { ticks: 9, deployed: 0 },
    { ticks: 10, deployed: 1 },
  ])('shows Human Deployed $deployed after $ticks ticks', ({ ticks, deployed }) => {
    const lane = runTicks(emptyLane(), defaultParams(LANE_IDS.human), ticks)
    expect(displayedDeployed(lane)).toBe(deployed)
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

describe('detection', () => {
  it('is 0.8 x sizeFactor x speedFactor', () => {
    expect(detection(300, 750)).toBeCloseTo(0.8 * sizeFactor(300) * speedFactor(750), 12)
  })
})

describe('Defects caught for a lane as displayed', () => {
  const caught = (laneId, overrides) => formatDefectsCaught(paramsFor(laneId, overrides))

  it.each([
    { prSize: 50, shown: '80%' },
    { prSize: 200, shown: '80%' },
    { prSize: 300, shown: '42%' },
    { prSize: 400, shown: '4%' },
    { prSize: 1000, shown: '4%' },
  ])('Human at PR size $prSize catches $shown', ({ prSize, shown }) => {
    expect(caught(LANE_IDS.human, { prSize })).toBe(shown)
  })

  it.each([
    { reviewerSpeed: 500, shown: '80%' },
    { reviewerSpeed: 750, shown: '44%' },
    { reviewerSpeed: 900, shown: '22%' },
    { reviewerSpeed: 1000, shown: '8%' },
  ])(
    'Human at PR size 200 and $reviewerSpeed LOC/hr catches $shown',
    ({ reviewerSpeed, shown }) => {
      expect(caught(LANE_IDS.human, { prSize: 200, reviewerSpeed })).toBe(shown)
    },
  )

  it.each([
    { laneId: LANE_IDS.human, shown: '61%' },
    { laneId: LANE_IDS.ai, shown: '10%' },
  ])('catches $shown in the $laneId lane at the defaults', ({ laneId, shown }) => {
    expect(caught(laneId, {})).toBe(shown)
  })

  it.each([
    { skim: 3, shown: '3%' },
    { skim: 1, shown: '12%' },
  ])('AI at skim $skim catches $shown', ({ skim, shown }) => {
    expect(caught(LANE_IDS.ai, { skim })).toBe(shown)
  })

  it('shows 6% for a drained queue (PR size 250 at 1000 LOC/hr)', () => {
    expect(caught(LANE_IDS.human, { reviewerSpeed: 1000 })).toBe('6%')
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
