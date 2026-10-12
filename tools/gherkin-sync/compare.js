// Compares Gherkin scenarios with the tests that claim them and returns a list of problems.
//
// A test claims a scenario when its title is the scenario name, or the name followed by
// ': ' and a suffix (used to tell Scenario Outline rows apart). Tests that claim no scenario
// are extra tests and are ignored.
//
// Scenarios marked wip are pending: they are skipped by the step check and the completeness
// check, and tests that claim them are ignored. They still count for duplicate-name detection.
//
// tests: [{ title, location, ran, passed, steps }], where steps are the test's top-level
// test.step titles in order. Only passed tests are step-checked; a failing test already
// fails the run.
// complete: true when every test was selected, so missing scenarios and rows can be reported.

const claims = (title, name) => title === name || title.startsWith(`${name}: `)

const sameSteps = (expected, actual) =>
  expected.length === actual.length && expected.every((line, index) => line === actual[index])

const commonPrefixLength = (expected, actual) => {
  const firstDifference = expected.findIndex((line, index) => line !== actual[index])
  return firstDifference === -1 ? expected.length : firstDifference
}

const closestVariant = (variants, actual) =>
  variants.reduce((best, variant) =>
    commonPrefixLength(variant.steps, actual) > commonPrefixLength(best.steps, actual)
      ? variant
      : best,
  )

const describeMismatch = (expected, actual) => {
  const index = commonPrefixLength(expected, actual)
  const wanted = expected[index] ?? '(no more steps)'
  const got = actual[index] ?? '(no more steps)'
  return `step ${index + 1}: expected "${wanted}", got "${got}"`
}

const duplicateNameProblems = (scenarios) => {
  const seen = new Map()
  return scenarios.flatMap(({ name, location }) => {
    const earlier = seen.get(name)
    seen.set(name, location)
    return earlier ? [`Scenario name "${name}" is used twice (${earlier}, ${location})`] : []
  })
}

const scenarioClaimedBy = (scenarios, title) =>
  scenarios
    .filter(({ name }) => claims(title, name))
    .reduce(
      (longest, scenario) =>
        !longest || scenario.name.length > longest.name.length ? scenario : longest,
      null,
    )

const stepProblems = (scenario, test) => {
  if (scenario.variants.some(({ steps }) => sameSteps(steps, test.steps))) return []
  const variant = closestVariant(scenario.variants, test.steps)
  const row = variant.example ? ` (closest Examples row: ${variant.example})` : ''
  return [
    `${test.location} "${test.title}" does not follow scenario "${scenario.name}" (${scenario.location})${row}: ${describeMismatch(variant.steps, test.steps)}`,
  ]
}

const coverageProblems = (scenario, claimants) => {
  if (claimants.length === 0) {
    return [`Scenario "${scenario.name}" (${scenario.location}) has no test with that title`]
  }
  // A --list run only checks titles. A failed claimant already fails the run, and a passing
  // claimant with the wrong steps is already reported, so rows are judged only when every
  // claimant passed and follows some row.
  if (!claimants.some(({ ran }) => ran)) return []
  if (!claimants.every(({ passed }) => passed)) return []
  const followsSomeVariant = (test) =>
    scenario.variants.some(({ steps }) => sameSteps(steps, test.steps))
  if (!claimants.every(followsSomeVariant)) return []
  return scenario.variants
    .filter(({ steps }) => !claimants.some((test) => sameSteps(steps, test.steps)))
    .map(({ example }) =>
      example
        ? `Scenario "${scenario.name}" (${scenario.location}) has no test for Examples row: ${example}`
        : `Scenario "${scenario.name}" (${scenario.location}) has no test that follows its steps`,
    )
}

export const compareScenariosWithTests = (allScenarios, tests, { complete }) => {
  const scenarios = allScenarios.filter(({ wip }) => !wip)
  const claimed = tests.map((test) => ({
    test,
    scenario: scenarioClaimedBy(scenarios, test.title),
  }))
  const mismatches = claimed
    .filter(({ test, scenario }) => scenario && test.passed)
    .flatMap(({ test, scenario }) => stepProblems(scenario, test))
  const gaps = complete
    ? scenarios.flatMap((scenario) =>
        coverageProblems(
          scenario,
          claimed.filter((entry) => entry.scenario === scenario).map(({ test }) => test),
        ),
      )
    : []
  return [...duplicateNameProblems(allScenarios), ...mismatches, ...gaps]
}

// Counts the pending (wip) scenarios. In strict mode any pending scenario fails the run.
export const pendingReport = (scenarios, { strict }) => {
  const count = scenarios.filter(({ wip }) => wip).length
  return {
    count,
    message: count > 0 ? `${count} @wip scenario(s) pending` : null,
    failed: strict && count > 0,
  }
}
