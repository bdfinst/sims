import { describe, expect, it } from 'vitest'
import { MODEL_ASSUMPTIONS } from './engine.js'
import { FINDINGS, assumptionsNote } from './research.js'

const FORBIDDEN_PHRASES = ['near zero', 'coined', 'originated']

describe('MODEL_ASSUMPTIONS', () => {
  it('reports the model constants the note discloses', () => {
    expect(MODEL_ASSUMPTIONS).toEqual({
      defectsPerKloc: 20,
      sizeFloor: 0.05,
      speedFloor: 0.1,
      sizeKnee: 200,
      sizeWall: 400,
      speedKnee: 500,
      speedWall: 1000,
      aiSizeMultiplier: 1.51,
    })
  })
})

describe('assumptionsNote', () => {
  it('is built from the assumptions it is given, so it cannot drift from the model', () => {
    const note = assumptionsNote({ ...MODEL_ASSUMPTIONS, aiSizeMultiplier: 2.25 })
    expect(note).toContain('2.25 size multiplier')
    expect(note).not.toContain('1.51')
  })

  it('states every disclosed number from the real model', () => {
    const note = assumptionsNote()
    for (const text of ['20 defects', '0.05', '0.1', '200', '400', '500', '1,000', '1.51']) {
      expect(note).toContain(text)
    }
  })
})

describe('research data', () => {
  it('has five findings, each with a source link', () => {
    expect(FINDINGS).toHaveLength(5)
    for (const { source } of FINDINGS) expect(source.url).toMatch(/^https:\/\//)
  })

  it('never uses the unsupported or misattributing wording', () => {
    const everyText = [...FINDINGS.map(({ text }) => text), assumptionsNote()]
      .join(' ')
      .toLowerCase()
    for (const phrase of FORBIDDEN_PHRASES) expect(everyText).not.toContain(phrase)
  })
})
