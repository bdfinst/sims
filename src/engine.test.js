import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS,
  LANE_IDS,
  LANE_MODELS,
  SLIDERS,
  elapsedHours,
  emptyLane,
  floorShow,
  laneParams,
  tick,
} from './engine.js'

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
    expect([floorShow(lane.pendingPrs), floorShow(lane.deployedPrs)]).toEqual([0, 10])
  })

  it('backs up 184 PRs in the AI queue and deploys 15 after 10 seconds', () => {
    const lane = runTicks(emptyLane(), defaultParams(LANE_IDS.ai), 100)
    expect([floorShow(lane.pendingPrs), floorShow(lane.deployedPrs)]).toEqual([184, 15])
  })

  it('holds 69,600 pending LOC in the AI queue after 10 seconds', () => {
    const lane = runTicks(emptyLane(), defaultParams(LANE_IDS.ai), 100)
    expect(Math.round(lane.pendingLoc)).toBe(69600)
  })
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
  it('never lets a queue go negative when review capacity exceeds the queue', () => {
    const backlog = { ...emptyLane(), pendingPrs: 0.5, pendingLoc: 125 }
    const params = { gen: 0, size: 250, effSpeed: 1500 }
    const lane = tick(backlog, params)
    expect([lane.pendingPrs, lane.pendingLoc]).toEqual([0, 0])
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

describe('elapsedHours', () => {
  it.each([
    { ticks: 0, shown: '0.0' },
    { ticks: 30, shown: '3.0' },
    { ticks: 100, shown: '10.0' },
  ])('shows $shown for $ticks ticks', ({ ticks, shown }) => {
    expect(elapsedHours(ticks)).toBe(shown)
  })
})
