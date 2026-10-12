import {
  AI_SKIM_LABEL,
  HUMAN_GEN_LABEL,
  PR_SIZE_LABEL,
  REFERENCE,
  REVIEWER_SPEED_LABEL,
  SECOND_MS,
  TICKS_PER_SECOND,
  TICK_MS,
  buttonNamed,
  expect,
  expectCounts,
  expectElapsedAtTick,
  metric,
  metricValues,
  openSimulator,
  pauseSimulation,
  sampleEachTick,
  setSlider,
  startAndRunFor,
  startSimulation,
  test,
} from './fixtures.js'

const SIZE_CASES = [
  { size: 50, caught: '80%' },
  { size: 200, caught: '80%' },
  { size: 300, caught: '42%' },
  { size: 400, caught: '4%' },
  { size: 1000, caught: '4%' },
]

const SPEED_CASES = [
  { speed: 500, caught: '80%' },
  { speed: 750, caught: '44%' },
  { speed: 900, caught: '22%' },
  { speed: 1000, caught: '8%' },
]

const SIZE_AT_DETECTION_KNEE = 200
const HUMAN_CAUGHT_AT_REST = '61%'
const AI_CAUGHT_AT_REST = '10%'
const AI_CAUGHT_AT_MAX_SKIM = '3%'
const AI_CAUGHT_AT_HUMAN_PACE = '12%'
const MAX_SKIM = 3
const HUMAN_PACE_SKIM = 1

const NO_VALUE = '—'
const NO_WAIT = '0.0 h'
const LANE_IDS = ['human', 'ai']
const DEFAULT_RUN_SECONDS = 10
const SIZE_CHANGE_AT_SECONDS = 1
const OVERSIZED_PR = 400
const QUEUE_BUILDING_SECONDS = 2
const BUSY_HUMAN_GEN = 10
const RESIZED_QUEUE_PR_SIZE = 500
const RESIZED_QUEUE_SECONDS = 1
const FAST_REVIEWER_SPEED = 1000
const DRAIN_SECONDS = 6
const LOWEST_RESEARCH_RATIO = 3
const HIGHEST_RESEARCH_RATIO = 4
const HEADLINE_HOOK = '[data-metric="headlineRatio"]'

const headline = (page) => page.locator(HEADLINE_HOOK)
const expectMetric = (page, laneId, name, shown) =>
  expect(metric(page, laneId, name)).toHaveText(String(shown))

const expectNoIncidents = async (page) => {
  for (const laneId of LANE_IDS) {
    await expectMetric(page, laneId, 'incidents', 0)
    await expectMetric(page, laneId, 'incidentsPerPr', NO_VALUE)
    await expectMetric(page, laneId, 'pickupWait', NO_WAIT)
  }
  await expect(headline(page)).toHaveText(NO_VALUE)
}

const expectDefectsCaught = (page, laneId, shown) =>
  expect(metric(page, laneId, 'defectsCaught')).toHaveText(shown)

test.describe('Review quality metrics', () => {
  test('Defects caught and pending LOC at rest', async ({ page }) => {
    await openSimulator(page)

    await expectDefectsCaught(page, 'human', HUMAN_CAUGHT_AT_REST)
    await expect(metric(page, 'human', 'pendingLoc')).toHaveText('0')
    await expectDefectsCaught(page, 'ai', AI_CAUGHT_AT_REST)
    await expect(metric(page, 'ai', 'pendingLoc')).toHaveText('0')
  })

  for (const { size, caught } of SIZE_CASES) {
    test(`Defects caught follows PR size: ${size} LOC gives ${caught}`, async ({ page }) => {
      await openSimulator(page)

      await setSlider(page, PR_SIZE_LABEL, size)

      await expectDefectsCaught(page, 'human', caught)
    })
  }

  for (const { speed, caught } of SPEED_CASES) {
    test(`Defects caught follows reviewer speed: ${speed} LOC/hr gives ${caught}`, async ({
      page,
    }) => {
      await openSimulator(page)

      await setSlider(page, PR_SIZE_LABEL, SIZE_AT_DETECTION_KNEE)
      await setSlider(page, REVIEWER_SPEED_LABEL, speed)

      await expectDefectsCaught(page, 'human', caught)
    })
  }

  test('Skimming harder lowers AI defects caught', async ({ page }) => {
    await openSimulator(page)

    await setSlider(page, AI_SKIM_LABEL, MAX_SKIM)

    await expectDefectsCaught(page, 'ai', AI_CAUGHT_AT_MAX_SKIM)
  })

  test('Reviewing AI code at human pace restores some catching', async ({ page }) => {
    await openSimulator(page)

    await setSlider(page, AI_SKIM_LABEL, HUMAN_PACE_SKIM)

    await expectDefectsCaught(page, 'ai', AI_CAUGHT_AT_HUMAN_PACE)
  })

  test('Incident metrics at rest', async ({ page }) => {
    await openSimulator(page)

    await expectNoIncidents(page)
  })

  test('Default metrics after 10 seconds', async ({ page }) => {
    await openSimulator(page)

    await startAndRunFor(page, DEFAULT_RUN_SECONDS)

    await expectMetric(page, 'human', 'incidents', REFERENCE.humanIncidentsAtTick100)
    await expectMetric(page, 'human', 'incidentsPerPr', REFERENCE.humanIncidentsPerPrAtTick100)
    await expectMetric(page, 'human', 'pickupWait', NO_WAIT)
    await expectMetric(page, 'ai', 'incidents', REFERENCE.aiIncidentsAtTick100)
    await expectMetric(page, 'ai', 'incidentsPerPr', REFERENCE.aiIncidentsPerPrAtTick100)
    await expectMetric(page, 'ai', 'pickupWait', REFERENCE.aiPickupWaitAtTick100)
    await expectMetric(page, 'ai', 'pendingLoc', REFERENCE.aiPendingLocAtTick100)
    await expect(headline(page)).toHaveText(REFERENCE.headlineRatioAtTick100)
  })

  test('The research effect emerges at the defaults', async ({ page }) => {
    await openSimulator(page)

    await startAndRunFor(page, DEFAULT_RUN_SECONDS)

    const ratio = Number.parseFloat(await headline(page).textContent())
    expect(ratio).toBeGreaterThan(LOWEST_RESEARCH_RATIO)
    expect(ratio).toBeLessThan(HIGHEST_RESEARCH_RATIO)
  })

  test('Incidents per PR waits for a whole deployed PR', async ({ page }) => {
    await openSimulator(page)
    await startSimulation(page)

    await page.clock.runFor(0.9 * SECOND_MS)
    await expectElapsedAtTick(page, 0.9 * TICKS_PER_SECOND)
    await expectMetric(page, 'human', 'deployed', REFERENCE.humanDeployedAtTick9)
    await expectMetric(page, 'human', 'incidentsPerPr', NO_VALUE)
    await expect(headline(page)).toHaveText(NO_VALUE)

    await page.clock.runFor(0.1 * SECOND_MS)
    await expectMetric(page, 'human', 'deployed', 1)
    await expectMetric(page, 'human', 'incidentsPerPr', REFERENCE.humanIncidentsPerPrAtTick10)
  })

  test('Larger PRs accrue more incidents', async ({ page }) => {
    await openSimulator(page)
    await setSlider(page, PR_SIZE_LABEL, OVERSIZED_PR)

    await startAndRunFor(page, DEFAULT_RUN_SECONDS)

    await expectCounts(page, 'human', {
      pending: REFERENCE.humanPendingAtTick100WithPrSize400,
      deployed: REFERENCE.humanDeployedAtTick100WithPrSize400,
    })
    await expectMetric(page, 'human', 'incidents', REFERENCE.humanIncidentsAtTick100WithPrSize400)
    await expectMetric(
      page,
      'human',
      'incidentsPerPr',
      REFERENCE.humanIncidentsPerPrAtTick100WithPrSize400,
    )
  })

  test('A size change while running changes defects caught and accrual on the next tick', async ({
    page,
  }) => {
    await openSimulator(page)
    await startAndRunFor(page, SIZE_CHANGE_AT_SECONDS)

    await setSlider(page, PR_SIZE_LABEL, OVERSIZED_PR)
    await page.clock.runFor(TICK_MS)
    await expectMetric(page, 'human', 'defectsCaught', REFERENCE.humanDefectsCaughtAtPrSize400)

    await page.clock.runFor((DEFAULT_RUN_SECONDS - SIZE_CHANGE_AT_SECONDS) * SECOND_MS - TICK_MS)
    await expectElapsedAtTick(page, DEFAULT_RUN_SECONDS * TICKS_PER_SECOND)
    await expectMetric(
      page,
      'human',
      'incidents',
      REFERENCE.humanIncidentsAtTick100AfterSizeChangeAtTick10,
    )
    await expectMetric(
      page,
      'human',
      'incidentsPerPr',
      REFERENCE.humanIncidentsPerPrAtTick100AfterSizeChangeAtTick10,
    )
  })

  test('Queued PRs keep their size when PR size changes', async ({ page }) => {
    await openSimulator(page)
    await setSlider(page, HUMAN_GEN_LABEL, BUSY_HUMAN_GEN)
    await startAndRunFor(page, QUEUE_BUILDING_SECONDS)
    await expectMetric(page, 'human', 'pending', REFERENCE.humanPendingAtTick20WithHumanGen10)
    await expectMetric(page, 'human', 'pendingLoc', REFERENCE.humanPendingLocAtTick20WithHumanGen10)

    await pauseSimulation(page)
    await setSlider(page, PR_SIZE_LABEL, RESIZED_QUEUE_PR_SIZE)
    await startSimulation(page)
    await page.clock.runFor(RESIZED_QUEUE_SECONDS * SECOND_MS)
    await expectElapsedAtTick(
      page,
      (QUEUE_BUILDING_SECONDS + RESIZED_QUEUE_SECONDS) * TICKS_PER_SECOND,
    )

    await expectMetric(
      page,
      'human',
      'pending',
      REFERENCE.humanPendingAtTick30AfterSizeChangeToPrSize500,
    )
    await expectMetric(
      page,
      'human',
      'pendingLoc',
      REFERENCE.humanPendingLocAtTick30AfterSizeChangeToPrSize500,
    )
  })

  test('A drained queue shows no wait', async ({ page }) => {
    await openSimulator(page)
    await setSlider(page, HUMAN_GEN_LABEL, BUSY_HUMAN_GEN)
    await startAndRunFor(page, QUEUE_BUILDING_SECONDS)

    await setSlider(page, HUMAN_GEN_LABEL, 1)
    await setSlider(page, REVIEWER_SPEED_LABEL, FAST_REVIEWER_SPEED)
    await page.clock.runFor(DRAIN_SECONDS * SECOND_MS)
    await expectElapsedAtTick(page, (QUEUE_BUILDING_SECONDS + DRAIN_SECONDS) * TICKS_PER_SECOND)

    await expectMetric(page, 'human', 'pending', 0)
    await expectMetric(page, 'human', 'pickupWait', NO_WAIT)
    await expectMetric(page, 'human', 'defectsCaught', REFERENCE.humanDefectsCaughtWhenDrained)
  })

  test('Incidents never decrease while running', async ({ page }) => {
    await openSimulator(page)
    await startSimulation(page)

    const samples = await sampleEachTick(page, {
      startTick: 0,
      tickCount: DEFAULT_RUN_SECONDS * TICKS_PER_SECOND,
      read: () => metricValues(page, 'incidents'),
    })

    const decreases = samples
      .slice(1)
      .filter((current, sampleIndex) =>
        Object.entries(current).some(([laneId, count]) => count < samples[sampleIndex][laneId]),
      )
    expect(decreases).toEqual([])
    expect(samples.at(-1).ai).toBeGreaterThan(0)
  })

  test('Reset clears the metrics', async ({ page }) => {
    await openSimulator(page)
    await startAndRunFor(page, DEFAULT_RUN_SECONDS)
    await expect(headline(page)).toHaveText(REFERENCE.headlineRatioAtTick100)

    await buttonNamed(page, 'Reset').click()

    await expectNoIncidents(page)
  })
})
