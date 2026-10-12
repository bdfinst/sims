import { describe, expect, it } from 'vitest'
import { compareScenariosWithTests, pendingReport } from './compare.js'

const START = {
  name: 'Start switches the button to Pause',
  location: 'features/run.feature:3',
  variants: [{ example: null, steps: ['Given I open the simulator', 'When I press Start'] }],
}

const BOUNDS = {
  name: 'Sliders stop at their bounds',
  location: 'features/controls.feature:9',
  variants: [
    { example: 'AI gen | ArrowRight | 50', steps: ['When I press ArrowRight 200 times'] },
    { example: 'AI gen | ArrowLeft | 5', steps: ['When I press ArrowLeft 200 times'] },
  ],
}

const WIP_START = { ...START, wip: true }
const WIP_BOUNDS = { ...BOUNDS, wip: true }

const passedTest = (title, steps) => ({
  title,
  location: 'e2e/x.spec.js:10',
  ran: true,
  passed: true,
  steps,
})

const FULL = { complete: true }
const PARTIAL = { complete: false }

describe('compareScenariosWithTests', () => {
  it('reports nothing when every scenario and row has a passing test with the exact steps', () => {
    const tests = [
      passedTest(START.name, START.variants[0].steps),
      passedTest(`${BOUNDS.name}: ArrowRight`, BOUNDS.variants[0].steps),
      passedTest(`${BOUNDS.name}: ArrowLeft`, BOUNDS.variants[1].steps),
    ]
    expect(compareScenariosWithTests([START, BOUNDS], tests, FULL)).toEqual([])
  })

  it('names the first differing step when a test performs a different action', () => {
    const tests = [passedTest(START.name, ['Given I open the simulator', 'When I press Reset'])]

    expect(compareScenariosWithTests([START], tests, PARTIAL)).toEqual([
      'e2e/x.spec.js:10 "Start switches the button to Pause" does not follow scenario "Start switches the button to Pause" (features/run.feature:3): step 2: expected "When I press Start", got "When I press Reset"',
    ])
  })

  it('reports a missing step, and an extra step, at the position where they occur', () => {
    const missing = passedTest(START.name, ['Given I open the simulator'])
    const extra = passedTest(START.name, [...START.variants[0].steps, 'Then something else'])

    const problems = compareScenariosWithTests([START], [missing, extra], PARTIAL)

    expect(problems).toEqual([
      expect.stringContaining('step 2: expected "When I press Start", got "(no more steps)"'),
      expect.stringContaining('step 3: expected "(no more steps)", got "Then something else"'),
    ])
  })

  it('points an outline test at its closest Examples row when it matches none', () => {
    const tests = [passedTest(`${BOUNDS.name}: End`, ['When I press End once'])]

    const [problem] = compareScenariosWithTests([BOUNDS], tests, PARTIAL)

    expect(problem).toContain('closest Examples row: AI gen | ArrowRight | 50')
    expect(problem).toContain(
      'step 1: expected "When I press ArrowRight 200 times", got "When I press End once"',
    )
  })

  it('reports an Examples row with no test on a full run', () => {
    const tests = [passedTest(`${BOUNDS.name}: ArrowRight`, BOUNDS.variants[0].steps)]

    expect(compareScenariosWithTests([BOUNDS], tests, FULL)).toEqual([
      'Scenario "Sliders stop at their bounds" (features/controls.feature:9) has no test for Examples row: AI gen | ArrowLeft | 5',
    ])
  })

  it('reports a scenario with no test titled after it on a full run', () => {
    expect(compareScenariosWithTests([START], [], FULL)).toEqual([
      'Scenario "Start switches the button to Pause" (features/run.feature:3) has no test with that title',
    ])
  })

  it('skips missing scenarios and rows on a partial run', () => {
    const tests = [passedTest(`${BOUNDS.name}: ArrowRight`, BOUNDS.variants[0].steps)]

    expect(compareScenariosWithTests([START, BOUNDS], tests, PARTIAL)).toEqual([])
  })

  it('checks only titles in a --list run, where no test ran', () => {
    const listed = { ...passedTest(START.name, []), ran: false, passed: false }

    expect(compareScenariosWithTests([START, BOUNDS], [listed], FULL)).toEqual([
      'Scenario "Sliders stop at their bounds" (features/controls.feature:9) has no test with that title',
    ])
  })

  it('does not step-check a failed test, because its steps stop where it failed', () => {
    const failed = { ...passedTest(START.name, ['Given I open the simulator']), passed: false }

    expect(compareScenariosWithTests([START], [failed], FULL)).toEqual([])
  })

  it('ignores tests whose titles claim no scenario', () => {
    const extraTest = passedTest('Every control has a visible focus ring', ['Given anything'])

    expect(compareScenariosWithTests([START], [extraTest], PARTIAL)).toEqual([])
  })

  it('does not treat a title that merely starts with a scenario name as a claim', () => {
    const lookalike = passedTest(`${START.name} twice`, ['Given anything'])

    expect(compareScenariosWithTests([START], [lookalike], PARTIAL)).toEqual([])
  })

  it('reports two scenarios that share a name, since titles could not tell them apart', () => {
    const twin = { ...START, location: 'features/other.feature:7' }

    expect(compareScenariosWithTests([START, twin], [], PARTIAL)).toEqual([
      'Scenario name "Start switches the button to Pause" is used twice (features/run.feature:3, features/other.feature:7)',
    ])
  })

  it('reports no problem for a wip scenario whose test drifted from its steps', () => {
    const drifted = passedTest(START.name, ['Given I open the simulator', 'When I press Reset'])

    expect(compareScenariosWithTests([WIP_START], [drifted], FULL)).toEqual([])
  })

  it('reports no problem for a wip scenario that has no test, on a full run', () => {
    expect(compareScenariosWithTests([WIP_START, WIP_BOUNDS], [], FULL)).toEqual([])
  })

  it('reports no missing Examples row for a wip outline', () => {
    const tests = [passedTest(`${BOUNDS.name}: ArrowRight`, BOUNDS.variants[0].steps)]

    expect(compareScenariosWithTests([WIP_BOUNDS], tests, FULL)).toEqual([])
  })

  it('still reports the same drift and the same gap for an untagged scenario', () => {
    const drifted = passedTest(START.name, ['Given I open the simulator', 'When I press Reset'])

    expect(compareScenariosWithTests([START], [drifted], FULL)).toHaveLength(1)
    expect(compareScenariosWithTests([START], [], FULL)).toHaveLength(1)
  })

  it('does not let a wip scenario hide a test that claims a different, untagged scenario', () => {
    const drifted = passedTest(START.name, ['Given I open the simulator', 'When I press Reset'])

    expect(compareScenariosWithTests([WIP_BOUNDS, START], [drifted], FULL)).toHaveLength(1)
  })

  it('still reports two scenarios that share a name when one of them is wip', () => {
    const twin = { ...WIP_START, location: 'features/other.feature:7' }

    expect(compareScenariosWithTests([START, twin], [], PARTIAL)).toEqual([
      'Scenario name "Start switches the button to Pause" is used twice (features/run.feature:3, features/other.feature:7)',
    ])
  })
})

describe('pendingReport', () => {
  it('counts wip scenarios, one per scenario even for an outline, and words the count', () => {
    expect(pendingReport([START, WIP_START, WIP_BOUNDS], { strict: false })).toEqual({
      count: 2,
      message: '2 @wip scenario(s) pending',
      failed: false,
    })
  })

  it('reports nothing pending when no scenario is wip', () => {
    expect(pendingReport([START, BOUNDS], { strict: false })).toEqual({
      count: 0,
      message: null,
      failed: false,
    })
  })

  it('fails in strict mode with one wip scenario', () => {
    expect(pendingReport([START, WIP_START], { strict: true })).toEqual({
      count: 1,
      message: '1 @wip scenario(s) pending',
      failed: true,
    })
  })

  it('passes in strict mode with no wip scenarios', () => {
    expect(pendingReport([START, BOUNDS], { strict: true }).failed).toBe(false)
  })
})
