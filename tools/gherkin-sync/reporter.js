// Playwright reporter that fails the run when an e2e test drifts from its Gherkin scenario.
// Each scenario test wraps its steps in test.step() titled with the exact step line from the
// .feature file ('When I press Start and 10 seconds pass'); this reporter compares those
// titles with the scenarios. Missing scenarios and Examples rows are reported only when the
// whole suite was selected, so running one file or one --grep stays usable.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { compareScenariosWithTests } from './compare.js'
import { scenariosFromFeature } from './expectations.js'

const MATCH_EVERYTHING = String(/.*/)
const NARROWING_FLAGS = ['--last-failed', '--only-changed']

const loadScenarios = (featuresDir) =>
  readdirSync(featuresDir, { recursive: true })
    .filter((file) => file.endsWith('.feature'))
    .sort()
    .flatMap((file) => {
      const uri = path.join(featuresDir, file)
      return scenariosFromFeature(readFileSync(uri, 'utf8'), uri)
    })

const specFilesIn = (testDir) =>
  readdirSync(testDir, { recursive: true })
    .filter((file) => file.endsWith('.spec.js'))
    .map((file) => path.join(testDir, file))

const isUnfiltered = (grep) =>
  [grep].flat().every((pattern) => String(pattern) === MATCH_EVERYTHING)

const wholeSuiteSelected = (config, suite) => {
  const selectedFiles = new Set(suite.allTests().map(({ location }) => location.file))
  return (
    !config.shard &&
    config.projects.every(
      ({ grep, grepInvert, testDir }) =>
        isUnfiltered(grep) &&
        !grepInvert &&
        specFilesIn(testDir).every((file) => selectedFiles.has(file)),
    ) &&
    !process.argv.some((arg) => NARROWING_FLAGS.includes(arg))
  )
}

const relative = (file) => path.relative(process.cwd(), file)

export default function createGherkinSyncReporter({ featuresDir = 'features' } = {}) {
  const outcomes = new Map()
  const context = {}

  return {
    printsToStdio: () => false,

    onBegin(config, suite) {
      context.config = config
      context.suite = suite
    },

    onTestEnd(test, result) {
      outcomes.set(test, {
        passed: result.status === 'passed',
        steps: result.steps
          .filter(({ category }) => category === 'test.step')
          .map(({ title }) => title),
      })
    },

    onEnd() {
      const { config, suite } = context
      const tests = suite.allTests().map((test) => {
        const outcome = outcomes.get(test)
        return {
          title: test.title,
          location: `${relative(test.location.file)}:${test.location.line}`,
          ran: Boolean(outcome),
          passed: outcome?.passed ?? false,
          steps: outcome?.steps ?? [],
        }
      })
      const complete = wholeSuiteSelected(config, suite)
      const problems = compareScenariosWithTests(loadScenarios(featuresDir), tests, { complete })
      const scope = complete ? 'all scenarios' : 'selected tests only (partial run)'

      if (problems.length === 0) {
        process.stdout.write(`\nGherkin sync: tests follow their scenarios (${scope}).\n`)
        return undefined
      }
      process.stderr.write(
        `\nGherkin sync: ${problems.length} problem(s) (${scope}):\n${problems.map((problem) => `  - ${problem}`).join('\n')}\n`,
      )
      return { status: 'failed' }
    },
  }
}
