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
// Command-line flags that select only some tests, as `--flag value` or `--flag=value`.
const NARROWING_FLAGS = [
  '-g',
  '--grep',
  '-G',
  '--grep-invert',
  '--last-failed',
  '--only-changed',
  '--test-list',
  '--test-list-invert',
]

const filesWithExtension = (dir, ext) =>
  readdirSync(dir, { recursive: true })
    .filter((file) => file.endsWith(ext))
    .sort()
    .map((file) => path.join(dir, file))

export const loadScenarios = (featuresDir) =>
  filesWithExtension(featuresDir, '.feature').flatMap((uri) =>
    scenariosFromFeature(readFileSync(uri, 'utf8'), uri),
  )

const specFilesIn = (testDir) => filesWithExtension(testDir, '.spec.js')

const isUnfiltered = (grep) =>
  [grep].flat().every((pattern) => String(pattern) === MATCH_EVERYTHING)

// Whether the command line narrows the run to some of the tests.
export const hasNarrowingFlag = (argv) =>
  argv.some((arg) => NARROWING_FLAGS.some((flag) => arg === flag || arg.startsWith(`${flag}=`)))

const wholeSuiteSelected = (config, suite, argv) => {
  const selectedFiles = new Set(suite.allTests().map(({ location }) => location.file))
  return (
    !config.shard &&
    config.projects.every(
      ({ grep, grepInvert, testDir }) =>
        isUnfiltered(grep) &&
        !grepInvert &&
        specFilesIn(testDir).every((file) => selectedFiles.has(file)),
    ) &&
    !hasNarrowingFlag(argv)
  )
}

const STRICT_ENV = 'GHERKIN_SYNC_STRICT'

const isStrict = () => process.env[STRICT_ENV] === '1'

const relative = (file) => path.relative(process.cwd(), file)

// Decides the run's result: problems fail it; in strict mode, pending scenarios fail it;
// otherwise it passes. The message is printed either way, with the pending count if any.
export const syncOutcome = ({ problems, pending, scope }) => {
  const pendingLine = pending.message ? `${pending.message}\n` : ''
  if (problems.length > 0) {
    return {
      failed: true,
      message: `\nGherkin sync: ${problems.length} problem(s) (${scope}):\n${problems.map((problem) => `  - ${problem}`).join('\n')}\n${pendingLine}`,
    }
  }
  if (pending.failed) {
    return {
      failed: true,
      message: `\nGherkin sync: ${STRICT_ENV}=1 and ${pending.message}.\n`,
    }
  }
  return {
    failed: false,
    message: `\nGherkin sync: tests follow their scenarios (${scope}).\n${pendingLine}`,
  }
}

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
      const complete = wholeSuiteSelected(config, suite, process.argv)
      const scenarios = loadScenarios(featuresDir)
      const problems = compareScenariosWithTests(scenarios, tests, { complete })
      const pending = pendingReport(scenarios, { strict: isStrict() })
      const scope = complete ? 'all scenarios' : 'selected tests only (partial run)'
      const { failed, message } = syncOutcome({ problems, pending, scope })

      if (failed) {
        process.stderr.write(message)
        return { status: 'failed' }
      }
      process.stdout.write(message)
      return undefined
    },
  }
}
