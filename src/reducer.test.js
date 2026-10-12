import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, floorShow } from './engine.js'
import { initialState, reducer } from './reducer.js'
import { shownCounts } from './testHelpers.js'

const dispatchAll = (state, ...types) =>
  types.reduce((current, type) => reducer(current, { type }), state)

const setSetting = (state, key, value) => reducer(state, { type: 'setSetting', key, value })

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
    expect(dispatchAll(initialState, 'start').isRunning).toBe(true)
  })

  it('pause clears isRunning', () => {
    expect(dispatchAll(initialState, 'start', 'pause').isRunning).toBe(false)
  })

  it('pausing while already paused changes nothing', () => {
    expect(dispatchAll(initialState, 'pause')).toEqual(initialState)
  })

  it('does not change lanes or ticks', () => {
    const toggled = dispatchAll(initialState, 'start', 'pause')
    expect([toggled.lanes, toggled.ticks]).toEqual([initialState.lanes, initialState.ticks])
  })
})

describe('tick', () => {
  it('advances ticks and both lanes while running', () => {
    const state = dispatchAll(initialState, 'start', ...repeat('tick', 100))
    expect({
      ticks: state.ticks,
      human: shownCounts(state.lanes.human),
      ai: shownCounts(state.lanes.ai),
    }).toEqual({ ticks: 100, human: [0, 10], ai: [184, 15] })
  })

  it('is a no-op while paused', () => {
    expect(dispatchAll(initialState, ...repeat('tick', 5))).toBe(initialState)
  })

  it('freezes counts after pause', () => {
    const paused = dispatchAll(initialState, 'start', ...repeat('tick', 30), 'pause')
    expect(dispatchAll(paused, ...repeat('tick', 50))).toBe(paused)
  })

  it('resumes from the frozen counts', () => {
    const paused = dispatchAll(initialState, 'start', ...repeat('tick', 30), 'pause')
    const resumed = dispatchAll(paused, 'start', ...repeat('tick', 10))
    expect(shownCounts(resumed.lanes.ai)).toEqual([73, 6])
  })

  it('does not mutate the previous state', () => {
    const running = dispatchAll(initialState, 'start')
    const next = reducer(running, { type: 'tick' })
    expect([next === running, running.ticks]).toEqual([false, 0])
  })
})

describe('setSetting', () => {
  it('updates the named setting and keeps the others', () => {
    const next = setSetting(initialState, 'aiGen', 40)
    expect(next.settings).toEqual({ ...DEFAULT_SETTINGS, aiGen: 40 })
  })

  it.each([
    { key: 'aiGen', value: 999, stored: 50 },
    { key: 'aiGen', value: 0, stored: 5 },
    { key: 'reviewerSpeed', value: -300, stored: 100 },
    { key: 'skim', value: 7, stored: 3 },
  ])('clamps $key=$value to $stored', ({ key, value, stored }) => {
    expect(setSetting(initialState, key, value).settings[key]).toBe(stored)
  })

  it.each([
    { key: 'prSize', value: 254, stored: 250 },
    { key: 'prSize', value: 256, stored: 260 },
    { key: 'skim', value: 2.2, stored: 2 },
    { key: 'skim', value: 2.3, stored: 2.5 },
    { key: 'reviewerSpeed', value: 320, stored: 300 },
  ])('snaps $key=$value to its step: $stored', ({ key, value, stored }) => {
    expect(setSetting(initialState, key, value).settings[key]).toBe(stored)
  })

  it.each(['nope', 'toString', 'constructor', '__proto__'])(
    'ignores the unknown key "%s"',
    (key) => {
      expect(setSetting(initialState, key, 5)).toBe(initialState)
    },
  )

  it.each([NaN, Infinity, undefined, null, '40'])('ignores the non-numeric value %s', (value) => {
    expect(setSetting(initialState, 'aiGen', value)).toBe(initialState)
  })

  it('does not touch lanes, ticks, or whether it is running', () => {
    const running = dispatchAll(initialState, 'start', ...repeat('tick', 5))
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
    const paused = dispatchAll(initialState, 'start', ...repeat('tick', 10), 'pause')
    expect(paused.lanes.ai.pendingPrs).toBeCloseTo(18.41, 2)

    const changed = setSetting(paused, 'aiGen', 50)
    expect(shownCounts(changed.lanes.ai)).toEqual([18, 1])

    const resumed = dispatchAll(changed, 'start', 'tick')
    expect(resumed.lanes.ai.pendingPrs).toBeCloseTo(23.25, 2)
    expect(shownCounts(resumed.lanes.ai)).toEqual([23, 1])
  })

  it('applies a faster review side on the very next tick (AI Deployed 1 -> 2)', () => {
    const running = dispatchAll(initialState, 'start', ...repeat('tick', 10))
    expect(shownCounts(running.lanes.ai)[1]).toBe(1)

    const faster = setSetting(setSetting(running, 'reviewerSpeed', 1000), 'skim', 3)
    const next = reducer(faster, { type: 'tick' })

    expect(shownCounts(next.lanes.ai)[1]).toBe(2)
    expect(next.isRunning).toBe(true)
  })

  it('drains a backlog to zero without ever going below zero', () => {
    const backlogged = setSetting(initialState, 'humanGen', 10)
    const atTwoSeconds = dispatchAll(backlogged, 'start', ...repeat('tick', 20))
    expect(shownCounts(atTwoSeconds.lanes.human)[0]).toBe(17)

    const draining = setSetting(setSetting(atTwoSeconds, 'humanGen', 1), 'reviewerSpeed', 1000)
    const pendingEachTick = Array.from({ length: 60 }).reduce(
      (acc) => {
        const next = reducer(acc.state, { type: 'tick' })
        return { state: next, shown: [...acc.shown, next.lanes.human.pendingPrs] }
      },
      { state: draining, shown: [] },
    ).shown

    expect(Math.min(...pendingEachTick)).toBeGreaterThanOrEqual(0)
    expect(floorShow(pendingEachTick.at(-1))).toBe(0)
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
