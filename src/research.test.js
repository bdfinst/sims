import { describe, expect, it } from 'vitest'
import { MODEL_ASSUMPTIONS } from './engine.js'
import { FINDINGS, assumptionsNote } from './research.js'

const FORBIDDEN_PHRASES = ['near zero', 'coined', 'originated']
const FAROS_URL = 'https://faros.ai/research/ai-acceleration-whiplash'

describe('assumptionsNote', () => {
  it('is built from the assumptions it is given, so it cannot drift from the model', () => {
    const { choices } = assumptionsNote({ ...MODEL_ASSUMPTIONS, aiSizeMultiplier: 2.25 })
    expect(choices).toContain('2.25 size multiplier')
    expect(choices).not.toContain('1.51')
  })

  it('states every disclosed number from the real model, as a labelled phrase', () => {
    const { choices } = assumptionsNote()
    const labelledPhrases = [
      '20 defects per 1,000 LOC',
      '0.05 for large PRs',
      '0.1 for fast reviewing',
      'PR size 200 to 400 LOC',
      'reviewer speed 500 to 1,000 LOC/hr',
      '1.51 size multiplier',
    ]
    for (const phrase of labelledPhrases) expect(choices).toContain(phrase)
  })

  it('links the calibration figure to Faros', () => {
    const { calibration } = assumptionsNote()
    expect(calibration.linkText).toBe("Faros's +242.7% incidents per PR")
    expect(calibration.url).toBe(FAROS_URL)
  })
})

describe('research data', () => {
  it('has five findings, each with a source link', () => {
    expect(FINDINGS).toHaveLength(5)
    for (const { id, source } of FINDINGS) {
      expect(source.url, `${id} url`).toMatch(/^https:\/\//)
      expect(source.label, `${id} label`).not.toBe('')
    }
  })

  it('shares one Faros figure between the finding and the calibration', () => {
    const faros = FINDINGS.find(({ source }) => source.url === FAROS_URL)
    expect(faros.text).toContain('(+242.7%)')
  })

  it('never uses the unsupported or misattributing wording', () => {
    const { choices, calibration } = assumptionsNote()
    const everyText = [
      ...FINDINGS.map(({ text }) => text),
      choices,
      calibration.lead,
      calibration.linkText,
    ]
      .join(' ')
      .toLowerCase()
    for (const phrase of FORBIDDEN_PHRASES) expect(everyText).not.toContain(phrase)
  })
})
