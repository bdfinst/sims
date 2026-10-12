import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, floorShow } from './engine.js'
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
