import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, LANE_IDS, LANE_MODELS, SLIDERS, laneParams } from './engine.js'

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
