import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, displayedIncidents, floorShow, formatHeadlineRatio } from './engine.js'
import { ACTION, initialState, reducer } from './reducer.js'
import { shownCounts } from './testHelpers.js'

const dispatchAll = (state, ...types) =>
  types.reduce((current, type) => reducer(current, { type }), state)

const setSetting = (state, settingKey, value) =>
  reducer(state, { type: ACTION.setSetting, settingKey, value })

// Oracles are literals from the plan's "Default arithmetic" (generation amendment).
const ONE_SECOND_IN_TICKS = 10
const TWO_SECONDS_IN_TICKS = 20
const TEN_SECONDS_IN_TICKS = 100
const DRAIN_TICKS = 60 // six seconds
const BUSY_AI = { aiLocPerHour: 2000 }
// Cut AI generation to the minimum and review fast (effective speed 2000 LOC/hr).
const DRAINING = { aiLocPerHour: 5, reviewerSpeed: 1000 }

const repeat = (type, count) => Array.from({ length: count }, () => type)

const withSettings = (state, settings) =>
  Object.entries(settings).reduce((current, [key, value]) => setSetting(current, key, value), state)

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
    const state = dispatchAll(
      initialState,
      ACTION.start,
      ...repeat(ACTION.tick, TEN_SECONDS_IN_TICKS),
    )
    expect({
      ticks: state.ticks,
      human: shownCounts(state.lanes.human),
      ai: shownCounts(state.lanes.ai),
    }).toEqual({ ticks: TEN_SECONDS_IN_TICKS, human: [0, 1], ai: [0, 1] })
  })

  it('is a no-op while paused', () => {
    expect(dispatchAll(initialState, ...repeat(ACTION.tick, 5))).toBe(initialState)
  })

  it('freezes counts after pause', () => {
    const paused = dispatchAll(initialState, ACTION.start, ...repeat(ACTION.tick, 30), ACTION.pause)
    expect(dispatchAll(paused, ...repeat(ACTION.tick, 50))).toBe(paused)
  })

  it('resumes from the frozen counts: busy AI is at 11 / 4 after 3 s and 15 / 6 one second later', () => {
    const busy = withSettings(initialState, BUSY_AI)
    const paused = dispatchAll(busy, ACTION.start, ...repeat(ACTION.tick, 30), ACTION.pause)
    expect(shownCounts(paused.lanes.ai)).toEqual([11, 4])

    const resumed = dispatchAll(paused, ACTION.start, ...repeat(ACTION.tick, ONE_SECOND_IN_TICKS))
    expect(shownCounts(resumed.lanes.ai)).toEqual([15, 6])
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
    const next = setSetting(initialState, 'aiLocPerHour', 400)
    expect(next.settings).toEqual({ ...DEFAULT_SETTINGS, aiLocPerHour: 400 })
  })

  it.each([
    { settingKey: 'humanLocPerHour', value: 999, stored: 200 },
    { settingKey: 'humanLocPerHour', value: 0, stored: 5 },
    { settingKey: 'humanPrsPerDay', value: 10, stored: 4 },
    { settingKey: 'humanPrsPerDay', value: 0, stored: 0.25 },
    { settingKey: 'aiLocPerHour', value: 5000, stored: 2000 },
    { settingKey: 'aiLocPerHour', value: 2, stored: 5 },
    { settingKey: 'reviewerSpeed', value: -300, stored: 100 },
    { settingKey: 'skim', value: 7, stored: 3 },
  ])('clamps $settingKey=$value to $stored', ({ settingKey, value, stored }) => {
    expect(setSetting(initialState, settingKey, value).settings[settingKey]).toBe(stored)
  })

  it.each([
    { settingKey: 'humanLocPerHour', value: 32, stored: 30 },
    { settingKey: 'humanLocPerHour', value: 33, stored: 35 },
    { settingKey: 'humanPrsPerDay', value: 0.3, stored: 0.25 },
    { settingKey: 'humanPrsPerDay', value: 0.4, stored: 0.5 },
    { settingKey: 'humanPrsPerDay', value: 0.75, stored: 0.75 },
    { settingKey: 'aiLocPerHour', value: 53.4, stored: 53 },
    { settingKey: 'aiLocPerHour', value: 53.6, stored: 54 },
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
    expect(setSetting(initialState, 'aiLocPerHour', value)).toBe(initialState)
  })

  it('does not touch lanes, ticks, or whether it is running', () => {
    const running = dispatchAll(initialState, ACTION.start, ...repeat(ACTION.tick, 5))
    const next = setSetting(running, 'humanPrsPerDay', 0.5)
    expect([next.lanes, next.ticks, next.isRunning]).toEqual([
      running.lanes,
      running.ticks,
      running.isRunning,
    ])
  })
})

// The busy AI lane (AI code written 2000) for `ticks` ticks, still running.
const busyAiRunning = (ticks) =>
  dispatchAll(withSettings(initialState, BUSY_AI), ACTION.start, ...repeat(ACTION.tick, ticks))

describe('changing settings mid-run', () => {
  it('leaves a paused queue as it was, then applies the new review speed on the next tick', () => {
    const paused = dispatchAll(busyAiRunning(ONE_SECOND_IN_TICKS), ACTION.pause)
    expect(paused.lanes.ai.pendingPrs).toBeCloseTo(3.863, 3)

    const changed = setSetting(paused, 'reviewerSpeed', 100)
    expect(shownCounts(changed.lanes.ai)).toEqual([3, 1])

    const resumed = dispatchAll(changed, ACTION.start, ACTION.tick)
    expect(resumed.lanes.ai.pendingPrs).toBeCloseTo(4.36, 2)
    expect(shownCounts(resumed.lanes.ai)).toEqual([4, 1])
  })

  it('applies a faster review side on the very next tick (AI Deployed 1 -> 2)', () => {
    const running = busyAiRunning(ONE_SECOND_IN_TICKS)
    expect(shownCounts(running.lanes.ai)[1]).toBe(1)

    const faster = withSettings(running, { reviewerSpeed: 1000, skim: 3 })
    const next = reducer(faster, { type: ACTION.tick })

    expect(shownCounts(next.lanes.ai)[1]).toBe(2)
    expect(next.isRunning).toBe(true)
  })

  it('drains a backlog to zero without ever going below zero', () => {
    const backlog = busyAiRunning(TWO_SECONDS_IN_TICKS)
    expect(shownCounts(backlog.lanes.ai)[0]).toBe(7)

    const draining = withSettings(backlog, DRAINING)
    const pendingEachTick = []
    let state = draining
    for (let tickIndex = 0; tickIndex < DRAIN_TICKS; tickIndex += 1) {
      state = reducer(state, { type: ACTION.tick })
      pendingEachTick.push(state.lanes.ai.pendingPrs)
    }

    expect(Math.min(...pendingEachTick)).toBeGreaterThanOrEqual(0)
    expect(floorShow(pendingEachTick.at(-1))).toBe(0)
  })
})

describe('incidents across a run', () => {
  const runningState = reducer(initialState, { type: ACTION.start })
  const afterTicks = (state, count) => dispatchAll(state, ...repeat(ACTION.tick, count))

  // Wiring only: one number per key shows the change reached the next ticks. engine.test.js pins
  // the full figures (7.08, Deployed 0 and no Incidents per PR, 3.71).
  it.each([
    { settingKey: 'humanLocPerHour', value: 50, incidents: 8 },
    { settingKey: 'humanPrsPerDay', value: 0.25, incidents: 5 },
    { settingKey: 'reviewerSpeed', value: 900, incidents: 4 },
  ])(
    'a $settingKey change to $value while running shows Human Incidents $incidents at 10 seconds',
    ({ settingKey, value, incidents }) => {
      const afterOneSecond = afterTicks(runningState, ONE_SECOND_IN_TICKS)
      const changed = setSetting(afterOneSecond, settingKey, value)

      const human = afterTicks(changed, TEN_SECONDS_IN_TICKS - ONE_SECOND_IN_TICKS).lanes.human

      expect(displayedIncidents(human)).toBe(incidents)
    },
  )

  it('never lets an incident count decrease while running, and ends above zero', () => {
    const samples = []
    let state = runningState
    for (let tickIndex = 0; tickIndex < TEN_SECONDS_IN_TICKS; tickIndex += 1) {
      state = reducer(state, { type: ACTION.tick })
      samples.push({ human: state.lanes.human.escapedDefects, ai: state.lanes.ai.escapedDefects })
    }

    const decreases = samples
      .slice(1)
      .filter(
        (current, sampleIndex) =>
          current.human < samples[sampleIndex].human || current.ai < samples[sampleIndex].ai,
      )
    expect(decreases).toEqual([])
    expect(samples.at(-1).human).toBeGreaterThan(0)
    expect(samples.at(-1).ai).toBeGreaterThan(0)
  })

  it('shows the headline ratio 3.65x after 10 default seconds', () => {
    const afterTenDefaultSeconds = afterTicks(runningState, TEN_SECONDS_IN_TICKS)
    expect(formatHeadlineRatio(afterTenDefaultSeconds.lanes)).toBe('3.65×')
  })
})

describe('reset', () => {
  const RUN_TICKS = 30
  const runningWithCustomSettings = () =>
    dispatchAll(
      setSetting(initialState, 'aiLocPerHour', 400),
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

  it('keeps customised code-written and PRs-per-day settings', () => {
    const customised = withSettings(initialState, {
      humanLocPerHour: 50,
      humanPrsPerDay: 0.5,
      aiLocPerHour: 1000,
    })

    expect(dispatchAll(customised, ACTION.reset).settings).toEqual({
      ...DEFAULT_SETTINGS,
      humanLocPerHour: 50,
      humanPrsPerDay: 0.5,
      aiLocPerHour: 1000,
    })
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
