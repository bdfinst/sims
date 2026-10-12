import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { pendingReport } from './compare.js'
import { hasNarrowingFlag, loadScenarios, syncOutcome } from './reporter.js'

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

describe('hasNarrowingFlag', () => {
  const PLAYWRIGHT = ['node', 'playwright', 'test']

  it.each([
    ['--grep AI', ['--grep', 'AI']],
    ['-g AI', ['-g', 'AI']],
    ['--grep=AI', ['--grep=AI']],
    ['-G AI', ['-G', 'AI']],
    ['--grep-invert=AI', ['--grep-invert=AI']],
    ['--last-failed', ['--last-failed']],
    ['--only-changed', ['--only-changed']],
    ['--only-changed=main', ['--only-changed=main']],
    ['--test-list tests.txt', ['--test-list', 'tests.txt']],
    ['--test-list-invert=tests.txt', ['--test-list-invert=tests.txt']],
  ])('treats %s as a partial run', (_flag, args) => {
    expect(hasNarrowingFlag([...PLAYWRIGHT, ...args])).toBe(true)
  })

  it('treats a plain run, or one with only non-narrowing flags, as a whole run', () => {
    expect(hasNarrowingFlag(PLAYWRIGHT)).toBe(false)
    expect(hasNarrowingFlag([...PLAYWRIGHT, '--repeat-each=5', '--reporter', 'list'])).toBe(false)
  })

  it('does not mistake a flag that merely starts with a narrowing flag for one', () => {
    expect(hasNarrowingFlag([...PLAYWRIGHT, '--grepx', '--last-failed-report'])).toBe(false)
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

  // The plan's scenarios, read straight from its ```gherkin blocks: one per Scenario line, @wip
  // when the tag line directly above it carries @wip.
  const planScenarios = () =>
    [...plan.matchAll(/^```gherkin\n([\s\S]*?)^```/gm)].flatMap(([, block]) => {
      const lines = block.split('\n').map((line) => line.trim())
      return lines.flatMap((line, index) => {
        const [, name] = line.match(/^Scenario(?: Outline)?:\s*(.*)$/) ?? []
        if (name === undefined) return []
        return [{ name, wip: (lines[index - 1] ?? '').split(/\s+/).includes('@wip') }]
      })
    })

  // Well below the plan's scenario count, so a parser that finds almost none fails.
  const MIN_PLAN_SCENARIOS = 50

  const wipNames = (scenarios) =>
    scenarios
      .filter(({ wip }) => wip)
      .map(({ name }) => name)
      .sort()

  it('exported features carry exactly the @wip tags the plan has', () => {
    const exported = loadScenarios(featuresDir)
    const planned = planScenarios()

    expect(planned.length, 'the plan has its scenarios').toBeGreaterThan(MIN_PLAN_SCENARIOS)
    expect(exported.length, 'one exported scenario per plan Scenario line').toBe(planned.length)
    expect(wipNames(exported)).toEqual(wipNames(planned))
  })
})
