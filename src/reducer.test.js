import { describe, it, expect } from 'vitest'
import { floorShow } from './engine.js'
import { initialState, reducer } from './reducer.js'

const dispatchAll = (state, ...types) =>
  types.reduce((current, type) => reducer(current, { type }), state)

const repeat = (type, count) => Array.from({ length: count }, () => type)

describe('initialState', () => {
  it('starts paused at tick 0 with default settings and empty lanes', () => {
    expect(initialState).toMatchObject({
      isRunning: false,
      ticks: 0,
      settings: { humanGen: 1, aiGen: 20, prSize: 250, reviewerSpeed: 300, skim: 2, threshold: 15 },
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
      human: [floorShow(state.lanes.human.pendingPrs), floorShow(state.lanes.human.deployedPrs)],
      ai: [floorShow(state.lanes.ai.pendingPrs), floorShow(state.lanes.ai.deployedPrs)],
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
    expect([
      floorShow(resumed.lanes.ai.pendingPrs),
      floorShow(resumed.lanes.ai.deployedPrs),
    ]).toEqual([73, 6])
  })

  it('does not mutate the previous state', () => {
    const running = dispatchAll(initialState, 'start')
    const next = reducer(running, { type: 'tick' })
    expect([next === running, running.ticks]).toEqual([false, 0])
  })
})

describe('unknown actions', () => {
  it('leave the state unchanged', () => {
    expect(reducer(initialState, { type: 'nope' })).toBe(initialState)
  })
})
