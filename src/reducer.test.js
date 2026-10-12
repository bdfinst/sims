import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './engine.js'
import { initialState, reducer } from './reducer.js'
import { shownCounts } from './testHelpers.js'

const dispatchAll = (state, ...types) =>
  types.reduce((current, type) => reducer(current, { type }), state)

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

describe('unknown actions', () => {
  it.each(['nope', 'toString', 'constructor', '__proto__', 'hasOwnProperty'])(
    'leave the state unchanged for type "%s"',
    (type) => {
      expect(reducer(initialState, { type })).toBe(initialState)
    },
  )
})
