import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS,
  floorShow,
  formatHeadlineRatio,
  formatIncidentsPerPr,
  formatLoc,
  formatPickupWait,
  laneParams,
  LANE_MODELS,
} from './engine.js'
import { ACTION, initialState, reducer } from './reducer.js'
import { shownCounts } from './testHelpers.js'

const dispatchAll = (state, ...types) =>
  types.reduce((current, type) => reducer(current, { type }), state)

const setSetting = (state, settingKey, value) =>
  reducer(state, { type: ACTION.setSetting, settingKey, value })

const repeat = (type, count) => Array.from({ length: count }, () => type)

describe('initialState', () => {
  it('starts paused at tick 0 with default settings and empty lanes', () => {
    expect(initialState).toMatchObject({
      isRunning: false,
      ticks: 0,
      settings: DEFAULT_SETTINGS,
      lanes: { human: { pendingPrs: 0, deployedPrs: 0 }, ai: { pendingPrs: 0, deployedPrs: 0 } },
    })
  })
})

describe('start and pause', () => {
  it('start sets isRunning', () => {
    expect(dispatchAll(initialState, ACTION.start).isRunning).toBe(true)
  })

  it('pause clears isRunning', () => {
    expect(dispatchAll(initialState, ACTION.start, ACTION.pause).isRunning).toBe(false)
  })

  it('pausing while already paused changes nothing', () => {
    expect(dispatchAll(initialState, ACTION.pause)).toEqual(initialState)
  })

  it('does not change lanes or ticks', () => {
    const toggled = dispatchAll(initialState, ACTION.start, ACTION.pause)
    expect([toggled.lanes, toggled.ticks]).toEqual([initialState.lanes, initialState.ticks])
  })
})

describe('tick', () => {
  it('advances ticks and both lanes while running', () => {
    const state = dispatchAll(initialState, ACTION.start, ...repeat(ACTION.tick, 100))
    expect({
      ticks: state.ticks,
      human: shownCounts(state.lanes.human),
      ai: shownCounts(state.lanes.ai),
    }).toEqual({ ticks: 100, human: [0, 10], ai: [184, 15] })
  })

  it('is a no-op while paused', () => {
    expect(dispatchAll(initialState, ...repeat(ACTION.tick, 5))).toBe(initialState)
  })

  it('freezes counts after pause', () => {
    const paused = dispatchAll(initialState, ACTION.start, ...repeat(ACTION.tick, 30), ACTION.pause)
    expect(dispatchAll(paused, ...repeat(ACTION.tick, 50))).toBe(paused)
  })

  it('resumes from the frozen counts', () => {
    const paused = dispatchAll(initialState, ACTION.start, ...repeat(ACTION.tick, 30), ACTION.pause)
    const resumed = dispatchAll(paused, ACTION.start, ...repeat(ACTION.tick, 10))
    expect(shownCounts(resumed.lanes.ai)).toEqual([73, 6])
  })

  it('does not mutate the previous state', () => {
    const running = dispatchAll(initialState, ACTION.start, ...repeat(ACTION.tick, 3))
    const snapshot = structuredClone(running)

    reducer(running, { type: ACTION.tick })

    expect(running).toEqual(snapshot)
  })
})

describe('setSetting', () => {
  it('updates the named setting and keeps the others', () => {
    const next = setSetting(initialState, 'aiGen', 40)
    expect(next.settings).toEqual({ ...DEFAULT_SETTINGS, aiGen: 40 })
  })

  it.each([
    { settingKey: 'aiGen', value: 999, stored: 50 },
    { settingKey: 'aiGen', value: 0, stored: 5 },
    { settingKey: 'reviewerSpeed', value: -300, stored: 100 },
    { settingKey: 'skim', value: 7, stored: 3 },
  ])('clamps $settingKey=$value to $stored', ({ settingKey, value, stored }) => {
    expect(setSetting(initialState, settingKey, value).settings[settingKey]).toBe(stored)
  })

  it.each([
    { settingKey: 'prSize', value: 254, stored: 250 },
    { settingKey: 'prSize', value: 256, stored: 260 },
    { settingKey: 'skim', value: 2.2, stored: 2 },
    { settingKey: 'skim', value: 2.3, stored: 2.5 },
    { settingKey: 'reviewerSpeed', value: 320, stored: 300 },
  ])('snaps $settingKey=$value to its step: $stored', ({ settingKey, value, stored }) => {
    expect(setSetting(initialState, settingKey, value).settings[settingKey]).toBe(stored)
  })

  it.each(['nope', 'toString', 'constructor', '__proto__'])(
    'ignores the unknown settingKey "%s"',
    (settingKey) => {
      expect(setSetting(initialState, settingKey, 5)).toBe(initialState)
    },
  )

  it.each([NaN, Infinity, undefined, null, '40'])('ignores the non-numeric value %s', (value) => {
    expect(setSetting(initialState, 'aiGen', value)).toBe(initialState)
  })

  it('does not touch lanes, ticks, or whether it is running', () => {
    const running = dispatchAll(initialState, ACTION.start, ...repeat(ACTION.tick, 5))
    const next = setSetting(running, 'prSize', 400)
    expect([next.lanes, next.ticks, next.isRunning]).toEqual([
      running.lanes,
      running.ticks,
      running.isRunning,
    ])
  })
})

describe('changing settings mid-run', () => {
  it('leaves a paused queue as it was, then applies the new rate on the next tick', () => {
    const paused = dispatchAll(initialState, ACTION.start, ...repeat(ACTION.tick, 10), ACTION.pause)
    expect(paused.lanes.ai.pendingPrs).toBeCloseTo(18.41, 2)

    const changed = setSetting(paused, 'aiGen', 50)
    expect(shownCounts(changed.lanes.ai)).toEqual([18, 1])

    const resumed = dispatchAll(changed, ACTION.start, ACTION.tick)
    expect(resumed.lanes.ai.pendingPrs).toBeCloseTo(23.25, 2)
    expect(shownCounts(resumed.lanes.ai)).toEqual([23, 1])
  })

  it('applies a faster review side on the very next tick (AI Deployed 1 -> 2)', () => {
    const running = dispatchAll(initialState, ACTION.start, ...repeat(ACTION.tick, 10))
    expect(shownCounts(running.lanes.ai)[1]).toBe(1)

    const faster = setSetting(setSetting(running, 'reviewerSpeed', 1000), 'skim', 3)
    const next = reducer(faster, { type: ACTION.tick })

    expect(shownCounts(next.lanes.ai)[1]).toBe(2)
    expect(next.isRunning).toBe(true)
  })

  it('drains a backlog to zero without ever going below zero', () => {
    const backlogged = setSetting(initialState, 'humanGen', 10)
    const atTwoSeconds = dispatchAll(backlogged, ACTION.start, ...repeat(ACTION.tick, 20))
    expect(shownCounts(atTwoSeconds.lanes.human)[0]).toBe(17)

    const draining = setSetting(setSetting(atTwoSeconds, 'humanGen', 1), 'reviewerSpeed', 1000)
    const pendingEachTick = []
    let state = draining
    for (let tickIndex = 0; tickIndex < 60; tickIndex += 1) {
      state = reducer(state, { type: ACTION.tick })
      pendingEachTick.push(state.lanes.human.pendingPrs)
    }

    expect(Math.min(...pendingEachTick)).toBeGreaterThanOrEqual(0)
    expect(floorShow(pendingEachTick.at(-1))).toBe(0)
  })
})

describe('incidents across a run', () => {
  const running = (...settings) =>
    settings.reduce(
      (state, [key, value]) => setSetting(state, key, value),
      reducer(initialState, { type: ACTION.start }),
    )
  const incidents = (lane) => floorShow(lane.escapedDefects)

  it('Larger PRs accrue more incidents: PR size 400 gives Human 2 / 7 / 57 / 7.68', () => {
    const human = dispatchAll(running(['prSize', 400]), ...repeat(ACTION.tick, 100)).lanes.human
    expect(shownCounts(human)).toEqual([2, 7])
    expect([incidents(human), formatIncidentsPerPr(human)]).toEqual([57, '7.68'])
  })

  it('a size change while running changes accrual from the next tick: 53 incidents, 6.94 per PR', () => {
    const atOneSecond = dispatchAll(running(), ...repeat(ACTION.tick, 10))
    const resized = setSetting(atOneSecond, 'prSize', 400)

    const human = dispatchAll(resized, ...repeat(ACTION.tick, 90)).lanes.human

    expect([incidents(human), formatIncidentsPerPr(human)]).toEqual([53, '6.94'])
  })

  it('queued PRs keep their size when PR size changes: Pending 17 / 4,400 LOC becomes 26 / 9,100', () => {
    const queued = dispatchAll(running(['humanGen', 10]), ...repeat(ACTION.tick, 20))
    expect([
      floorShow(queued.lanes.human.pendingPrs),
      formatLoc(queued.lanes.human.pendingLoc),
    ]).toEqual([17, '4,400'])

    const resized = dispatchAll(setSetting(queued, 'prSize', 500), ...repeat(ACTION.tick, 10))

    expect([
      floorShow(resized.lanes.human.pendingPrs),
      formatLoc(resized.lanes.human.pendingLoc),
    ]).toEqual([26, '9,100'])
  })

  it('a drained queue shows no wait', () => {
    const queued = dispatchAll(running(['humanGen', 10]), ...repeat(ACTION.tick, 20))
    const draining = setSetting(setSetting(queued, 'humanGen', 1), 'reviewerSpeed', 1000)

    const drained = dispatchAll(draining, ...repeat(ACTION.tick, 60))

    const { effSpeed } = laneParams(drained.settings, LANE_MODELS.human)
    expect([
      floorShow(drained.lanes.human.pendingPrs),
      formatPickupWait(drained.lanes.human.pendingLoc, effSpeed),
    ]).toEqual([0, '0.0 h'])
  })

  it('never lets an incident count decrease while running', () => {
    let state = running()
    let previous = [0, 0]
    for (let tickIndex = 0; tickIndex < 100; tickIndex += 1) {
      state = reducer(state, { type: ACTION.tick })
      const current = [state.lanes.human.escapedDefects, state.lanes.ai.escapedDefects]
      expect(current[0]).toBeGreaterThanOrEqual(previous[0])
      expect(current[1]).toBeGreaterThanOrEqual(previous[1])
      previous = current
    }
  })

  it('shows the headline ratio 3.48x after 10 default seconds, and blank at 9 ticks', () => {
    const at = (ticks) => dispatchAll(running(), ...repeat(ACTION.tick, ticks)).lanes
    expect(formatHeadlineRatio(at(100).ai, at(100).human)).toBe('3.48×')
    expect(formatHeadlineRatio(at(9).ai, at(9).human)).toBe('—')
  })
})

describe('reset', () => {
  const RUN_TICKS = 30
  const runningWithCustomSettings = () =>
    dispatchAll(
      setSetting(initialState, 'aiGen', 40),
      ACTION.start,
      ...repeat(ACTION.tick, RUN_TICKS),
    )

  // Proves there is something to clear, so a reset that did nothing could not pass.
  const expectRunHasProgressed = (state) => {
    expect(state.ticks).toBe(RUN_TICKS)
    expect(shownCounts(state.lanes.ai)).not.toEqual([0, 0])
  }

  it('returns the initial state, keeping only the settings', () => {
    const before = runningWithCustomSettings()
    expectRunHasProgressed(before)

    expect(dispatchAll(before, ACTION.reset)).toEqual({
      ...initialState,
      settings: before.settings,
    })
  })

  it('keeps a customised setting', () => {
    const before = runningWithCustomSettings()
    expect(before.settings.aiGen).toBe(40)
    expect(dispatchAll(before, ACTION.reset).settings.aiGen).toBe(40)
  })

  it('clears a paused run too', () => {
    const paused = dispatchAll(runningWithCustomSettings(), ACTION.pause)
    expectRunHasProgressed(paused)

    expect(dispatchAll(paused, ACTION.reset)).toEqual({
      ...initialState,
      settings: paused.settings,
    })
  })

  it('leaves the lanes frozen, so the shared empty lanes cannot be mutated', () => {
    const reset = dispatchAll(runningWithCustomSettings(), ACTION.reset)
    expect(Object.isFrozen(reset.lanes)).toBe(true)
    expect(Object.values(reset.lanes).every(Object.isFrozen)).toBe(true)
  })

  it('is idempotent on the initial state', () => {
    expect(dispatchAll(initialState, ACTION.reset)).toEqual(initialState)
  })

  it('does not mutate the state it was given', () => {
    const before = runningWithCustomSettings()
    const snapshot = structuredClone(before)
    reducer(before, { type: ACTION.reset })
    expect(before).toEqual(snapshot)
  })

  it('ignores ticks after a reset until Start is pressed', () => {
    const reset = dispatchAll(runningWithCustomSettings(), ACTION.reset)
    expect(dispatchAll(reset, ...repeat(ACTION.tick, 5))).toBe(reset)
  })
})

describe('unknown actions', () => {
  it.each(['nope', 'toString', 'constructor', '__proto__', 'hasOwnProperty'])(
    'leave the state unchanged for type "%s"',
    (type) => {
      expect(reducer(initialState, { type })).toBe(initialState)
    },
  )
})
