// Playwright reporter that fails the run when an e2e test drifts from its Gherkin scenario.
// Each scenario test wraps its steps in test.step() titled with the exact step line from the
// .feature file ('When I press Start and 10 seconds pass'); this reporter compares those
// titles with the scenarios. Missing scenarios and Examples rows are reported only when the
// whole suite was selected, so running one file or one --grep stays usable. Scenarios tagged
// @wip are skipped and counted; with GHERKIN_SYNC_STRICT=1 any pending scenario fails the run.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { compareScenariosWithTests, pendingReport } from './compare.js'
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

const STRICT_ENV = 'GHERKIN_SYNC_STRICT'

const isStrict = () => process.env[STRICT_ENV] === '1'

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
      const scenarios = loadScenarios(featuresDir)
      const problems = compareScenariosWithTests(scenarios, tests, { complete })
      const pending = pendingReport(scenarios, { strict: isStrict() })
      const scope = complete ? 'all scenarios' : 'selected tests only (partial run)'
      const pendingLine = pending.message ? `${pending.message}\n` : ''

      if (problems.length > 0) {
        process.stderr.write(
          `\nGherkin sync: ${problems.length} problem(s) (${scope}):\n${problems.map((problem) => `  - ${problem}`).join('\n')}\n${pendingLine}`,
        )
        return { status: 'failed' }
      }
      if (pending.failed) {
        process.stderr.write(`\nGherkin sync: ${STRICT_ENV}=1 and ${pending.message}.\n`)
        return { status: 'failed' }
      }
      process.stdout.write(
        `\nGherkin sync: tests follow their scenarios (${scope}).\n${pendingLine}`,
      )
      return undefined
    },
  }
}
