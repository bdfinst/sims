import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { pendingReport } from './compare.js'
import { loadScenarios, syncOutcome } from './reporter.js'

const SCOPE = 'all scenarios'
const PLAIN = { wip: false }
const WIP = { wip: true }

describe('syncOutcome', () => {
  it('fails in strict mode when scenarios are pending', () => {
    const pending = pendingReport([PLAIN, WIP, WIP], { strict: true })

    expect(syncOutcome({ problems: [], pending, scope: SCOPE })).toEqual({
      failed: true,
      message: '\nGherkin sync: GHERKIN_SYNC_STRICT=1 and 2 @wip scenario(s) pending.\n',
    })
  })

  it('passes outside strict mode when scenarios are pending, and prints the count', () => {
    const pending = pendingReport([PLAIN, WIP, WIP], { strict: false })

    expect(syncOutcome({ problems: [], pending, scope: SCOPE })).toEqual({
      failed: false,
      message:
        '\nGherkin sync: tests follow their scenarios (all scenarios).\n2 @wip scenario(s) pending\n',
    })
  })

  it('fails when there are problems, listing each one and the pending count', () => {
    const pending = pendingReport([PLAIN, WIP], { strict: false })
    const problems = ['first problem', 'second problem']

    expect(syncOutcome({ problems, pending, scope: SCOPE })).toEqual({
      failed: true,
      message:
        '\nGherkin sync: 2 problem(s) (all scenarios):\n  - first problem\n  - second problem\n1 @wip scenario(s) pending\n',
    })
  })
})

describe('the exported features', () => {
  const featuresDir = fileURLToPath(
    new URL('../../features/ai-vs-human-code-review-simulator', import.meta.url),
  )
  const plan = readFileSync(
    new URL('../../plans/ai-vs-human-code-review-simulator.md', import.meta.url),
    'utf8',
  )

  // Every @wip line inside the plan's ```gherkin blocks tags one scenario.
  const planWipLines = () =>
    [...plan.matchAll(/^```gherkin\n([\s\S]*?)^```/gm)]
      .flatMap(([, block]) => block.split('\n'))
      .filter((line) => line.trim() === '@wip').length

  it('carry @wip on the scenarios the plan tags', () => {
    const exportedWip = loadScenarios(featuresDir).filter(({ wip }) => wip).length

    expect(exportedWip).toBeGreaterThan(0)
    expect(exportedWip).toBe(planWipLines())
  })
})
