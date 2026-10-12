import {
  AI_SKIM_LABEL,
  ALL_LANE_IDS,
  NO_VALUE,
  REFERENCE,
  REVIEWER_SPEED_LABEL,
  SECOND_MS,
  TICKS_PER_SECOND,
  TICK_MS,
  buttonNamed,
  expect,
  expectCounts,
  expectElapsedAtTick,
  expectNeverDecreases,
  headline,
  laneLocator,
  metric,
  metricValues,
  openSimulator,
  pauseSimulation,
  sampleEachTick,
  setSlider,
  startAndRunFor,
  startSimulation,
  test,
  FULL_RUN_SECONDS,
  BUSY_HUMAN_GEN,
  FAST_REVIEWER_SPEED,
  DRAIN_SECONDS,
  QUIET_HUMAN_GEN,
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
const HUMAN_CAUGHT_AT_REST = '65%'
const AI_CAUGHT_AT_REST = '15%'
const AI_CAUGHT_AT_MAX_SKIM = '3%'
const AI_CAUGHT_AT_HUMAN_PACE = '12%'
const MAX_SKIM = 3
const HUMAN_PACE_SKIM = 1

const NO_WAIT = '0.0 h'
const SIZE_CHANGE_AT_SECONDS = 1
const OVERSIZED_PR = 400
const QUEUE_BUILDING_SECONDS = 2
const RESIZED_QUEUE_PR_SIZE = 500
const RESIZED_QUEUE_SECONDS = 1
const RESEARCH_RATIO_FLOOR = 3
const RESEARCH_RATIO_CEILING = 4
const NEARLY_A_PR_SECONDS = 0.9
const LAST_TENTH_SECONDS = 0.1
const FIRST_PR_DEPLOYED = 1
const TICK_AFTER_SIZE_CHANGE = 11
const UNAVAILABLE_TEXT = 'Not yet available'

const pendingReviewList = (page, laneId) =>
  laneLocator(page, laneId).locator('dl', { has: page.locator('[data-metric="pending"]') })
const metricsList = (page, laneId) =>
  laneLocator(page, laneId).locator('dl', { has: page.locator('[data-metric="incidents"]') })

const expectMetric = (page, laneId, name, shown) =>
  expect(metric(page, laneId, name)).toHaveText(String(shown))

const expectNoLaneIncidents = async (page) => {
  for (const laneId of ALL_LANE_IDS) {
    await expectMetric(page, laneId, 'incidents', 0)
    await expectMetric(page, laneId, 'incidentsPerPr', NO_VALUE)
    await expectMetric(page, laneId, 'pickupWait', NO_WAIT)
  }
}

const expectNoHeadlineRatio = (page) => expect(headline(page)).toHaveText(NO_VALUE)

const expectDefectsCaught = (page, laneId, shown) =>
  expect(metric(page, laneId, 'defectsCaught')).toHaveText(shown)

test.describe.configure({ mode: 'parallel' })

test.describe('Review quality metrics', () => {
  test('Defects caught and pending LOC at rest', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('Then the Human lane shows Defects caught 65% and Pending LOC 0', async () => {
      await expectDefectsCaught(page, 'human', HUMAN_CAUGHT_AT_REST)
      await expect(metric(page, 'human', 'pendingLoc')).toHaveText('0')
    })

    await test.step('And the AI lane shows Defects caught 15% and Pending LOC 0', async () => {
      await expectDefectsCaught(page, 'ai', AI_CAUGHT_AT_REST)
      await expect(metric(page, 'ai', 'pendingLoc')).toHaveText('0')
    })
  })

  for (const { size, caught } of SIZE_CASES) {
    // @wip: Step 8.5
    test.fixme(`Defects caught follows PR size: ${size} LOC gives ${caught}`, async ({ page }) => {
      const PR_SIZE_LABEL = 'PR size (LOC, both lanes)'

      await test.step(`Given I set "PR size (LOC, both lanes)" to ${size}`, async () => {
        await openSimulator(page)
        await setSlider(page, PR_SIZE_LABEL, size)
      })

      await test.step(`Then the Human lane shows Defects caught ${caught}`, async () => {
        await expectDefectsCaught(page, 'human', caught)
      })
    })
  }

  for (const { speed, caught } of SPEED_CASES) {
    // @wip: Step 8.5
    test.fixme(`Defects caught follows reviewer speed: ${speed} LOC/hr gives ${caught}`, async ({
      page,
    }) => {
      const PR_SIZE_LABEL = 'PR size (LOC, both lanes)'

      await test.step(`Given I set "PR size (LOC, both lanes)" to ${SIZE_AT_DETECTION_KNEE} and "Reviewer speed (LOC/hr, both lanes)" to ${speed}`, async () => {
        await openSimulator(page)
        await setSlider(page, PR_SIZE_LABEL, SIZE_AT_DETECTION_KNEE)
        await setSlider(page, REVIEWER_SPEED_LABEL, speed)
      })

      await test.step(`Then the Human lane shows Defects caught ${caught}`, async () => {
        await expectDefectsCaught(page, 'human', caught)
      })
    })
  }

  // @wip: Step 8.5
  test.fixme('Skimming harder lowers AI defects caught', async ({ page }) => {
    await test.step('Given I set "AI skim multiplier" to 3', async () => {
      await openSimulator(page)
      await setSlider(page, AI_SKIM_LABEL, MAX_SKIM)
    })

    await test.step('Then the AI lane shows Defects caught 3%', async () => {
      await expectDefectsCaught(page, 'ai', AI_CAUGHT_AT_MAX_SKIM)
    })
  })

  // @wip: Step 8.5
  test.fixme('Reviewing AI code at human pace restores some catching', async ({ page }) => {
    await test.step('Given I set "AI skim multiplier" to 1', async () => {
      await openSimulator(page)
      await setSlider(page, AI_SKIM_LABEL, HUMAN_PACE_SKIM)
    })

    await test.step('Then the AI lane shows Defects caught 12%', async () => {
      await expectDefectsCaught(page, 'ai', AI_CAUGHT_AT_HUMAN_PACE)
    })
  })

  test('Terms pair with their definitions at rest in the Human lane', async ({ page }) => {
    await openSimulator(page)

    await expect(pendingReviewList(page, 'human')).toMatchAriaSnapshot(`
      - term: Pending Review
      - definition: "0"
      - term: Pending LOC
      - definition: "0"
    `)
    await expect(metricsList(page, 'human')).toMatchAriaSnapshot(`
      - term: Deployed
      - definition: "0"
      - term: Defects caught
      - definition: ${HUMAN_CAUGHT_AT_REST}
      - term: Incidents
      - definition: "0"
      - term: Incidents per PR
      - definition: ${UNAVAILABLE_TEXT}
      - term: Pickup wait
      - definition: 0.0 h
    `)
  })

  test('Terms pair with their definitions at rest in the AI lane', async ({ page }) => {
    await openSimulator(page)

    await expect(metricsList(page, 'ai')).toMatchAriaSnapshot(`
      - term: Deployed
      - definition: "0"
      - term: Defects caught
      - definition: ${AI_CAUGHT_AT_REST}
      - term: Incidents
      - definition: "0"
      - term: Incidents per PR
      - definition: ${UNAVAILABLE_TEXT}
      - term: Pickup wait
      - definition: 0.0 h
    `)
  })

  test('The headline ratio reads as not yet available at rest', async ({ page }) => {
    await openSimulator(page)

    await expect(page.getByRole('region', { name: 'Headline ratio' })).toMatchAriaSnapshot(`
      - region "Headline ratio": ${UNAVAILABLE_TEXT} more incidents per PR from AI-generated code
    `)
  })

  test('Incident metrics at rest', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('Then both lanes show Incidents 0, Incidents per PR "—", and Pickup wait 0.0 h', async () => {
      await expectNoLaneIncidents(page)
    })

    await test.step('And the headline ratio shows "—"', async () => {
      await expectNoHeadlineRatio(page)
    })
  })

  // @wip: Step 8.5
  test.fixme('Default metrics after 10 seconds', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I press Start and 10 seconds pass', async () => {
      await startAndRunFor(page, FULL_RUN_SECONDS)
    })

    await test.step('Then the Human lane shows Incidents 19, Incidents per PR 1.95, Pickup wait 0.0 h', async () => {
      await expectMetric(page, 'human', 'incidents', REFERENCE.humanIncidentsAtTick100)
      await expectMetric(page, 'human', 'incidentsPerPr', REFERENCE.humanIncidentsPerPrAtTick100)
      await expectMetric(page, 'human', 'pickupWait', NO_WAIT)
    })

    await test.step('And the AI lane shows Incidents 107, Incidents per PR 6.79, Pickup wait 116.0 h, Pending LOC 69,600', async () => {
      await expectMetric(page, 'ai', 'incidents', REFERENCE.aiIncidentsAtTick100)
      await expectMetric(page, 'ai', 'incidentsPerPr', REFERENCE.aiIncidentsPerPrAtTick100)
      await expectMetric(page, 'ai', 'pickupWait', REFERENCE.aiPickupWaitAtTick100)
      await expectMetric(page, 'ai', 'pendingLoc', REFERENCE.aiPendingLocAtTick100)
    })

    await test.step('And the headline ratio shows "3.48×"', async () => {
      await expect(headline(page)).toHaveText(REFERENCE.headlineRatioAtTick100)
    })
  })

  test('The research effect emerges at the defaults', async ({ page }) => {
    await test.step('Given the simulation has run for 10 seconds with defaults', async () => {
      await openSimulator(page)
      await startAndRunFor(page, FULL_RUN_SECONDS)
    })

    await test.step('Then the headline ratio is between 3 and 4', async () => {
      const ratio = Number.parseFloat(await headline(page).textContent())
      expect(ratio).toBeGreaterThan(RESEARCH_RATIO_FLOOR)
      expect(ratio).toBeLessThan(RESEARCH_RATIO_CEILING)
    })
  })

  // @wip: Step 8.5
  test.fixme('Incidents per PR waits for a whole deployed PR', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I press Start and 0.9 seconds pass', async () => {
      await startSimulation(page)
      await page.clock.runFor(NEARLY_A_PR_SECONDS * SECOND_MS)
      await expectElapsedAtTick(page, NEARLY_A_PR_SECONDS * TICKS_PER_SECOND)
    })

    await test.step('Then the Human lane shows Deployed 0 and Incidents per PR "—"', async () => {
      await expectMetric(page, 'human', 'deployed', REFERENCE.humanDeployedAtTick9)
      await expectMetric(page, 'human', 'incidentsPerPr', NO_VALUE)
    })

    await test.step('And the headline ratio shows "—"', async () => {
      await expectNoHeadlineRatio(page)
    })

    await test.step('When 0.1 more seconds pass', async () => {
      await page.clock.runFor(LAST_TENTH_SECONDS * SECOND_MS)
    })

    await test.step('Then the Human lane shows Deployed 1 and Incidents per PR 1.95', async () => {
      await expectMetric(page, 'human', 'deployed', FIRST_PR_DEPLOYED)
      await expectMetric(page, 'human', 'incidentsPerPr', REFERENCE.humanIncidentsPerPrAtTick10)
    })
  })

  // @wip: Step 8.5
  test.fixme('Larger PRs accrue more incidents', async ({ page }) => {
    const PR_SIZE_LABEL = 'PR size (LOC, both lanes)'

    await test.step('Given I set "PR size (LOC, both lanes)" to 400', async () => {
      await openSimulator(page)
      await setSlider(page, PR_SIZE_LABEL, OVERSIZED_PR)
    })

    await test.step('When I press Start and 10 seconds pass', async () => {
      await startAndRunFor(page, FULL_RUN_SECONDS)
    })

    await test.step('Then the Human lane shows Pending Review 2, Deployed 7, Incidents 57, and Incidents per PR 7.68', async () => {
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
  })

  // @wip: Step 8.5
  test.fixme('A size change while running changes defects caught and accrual on the next tick', async ({
    page,
  }) => {
    const PR_SIZE_LABEL = 'PR size (LOC, both lanes)'

    await test.step('Given the simulation has run for 1 second with defaults', async () => {
      await openSimulator(page)
      await startAndRunFor(page, SIZE_CHANGE_AT_SECONDS)
    })

    await test.step('When I set "PR size (LOC, both lanes)" to 400', async () => {
      await setSlider(page, PR_SIZE_LABEL, OVERSIZED_PR)
      await expectMetric(page, 'human', 'defectsCaught', REFERENCE.humanDefectsCaughtAtPrSize400)
    })

    await test.step('And 0.1 seconds pass', async () => {
      await page.clock.runFor(TICK_MS)
      await expectElapsedAtTick(page, TICK_AFTER_SIZE_CHANGE)
    })

    await test.step('Then the Human lane shows Defects caught 4%', async () => {
      await expectMetric(page, 'human', 'defectsCaught', REFERENCE.humanDefectsCaughtAtPrSize400)
    })

    await test.step('When 8.9 more seconds pass', async () => {
      await page.clock.runFor((FULL_RUN_SECONDS - SIZE_CHANGE_AT_SECONDS) * SECOND_MS - TICK_MS)
      await expectElapsedAtTick(page, FULL_RUN_SECONDS * TICKS_PER_SECOND)
    })

    await test.step('Then the Human lane shows Incidents 53 and Incidents per PR 6.94', async () => {
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
  })

  // @wip: Step 8.5
  test.fixme('Queued PRs keep their size when PR size changes', async ({ page }) => {
    const HUMAN_GEN_LABEL = 'Human generation (PRs/hr)'
    const PR_SIZE_LABEL = 'PR size (LOC, both lanes)'

    await test.step('Given I set "Human generation (PRs/hr)" to 10 and the simulation has run for 2 seconds', async () => {
      await openSimulator(page)
      await setSlider(page, HUMAN_GEN_LABEL, BUSY_HUMAN_GEN)
      await startAndRunFor(page, QUEUE_BUILDING_SECONDS)
    })

    await test.step('And the Human lane shows Pending Review 17 and Pending LOC 4,400', async () => {
      await expectMetric(page, 'human', 'pending', REFERENCE.humanPendingAtTick20WithHumanGen10)
      await expectMetric(
        page,
        'human',
        'pendingLoc',
        REFERENCE.humanPendingLocAtTick20WithHumanGen10,
      )
    })

    await test.step('When I pause, set "PR size (LOC, both lanes)" to 500, and press Start', async () => {
      await pauseSimulation(page)
      await setSlider(page, PR_SIZE_LABEL, RESIZED_QUEUE_PR_SIZE)
      await startSimulation(page)
    })

    await test.step('And 1 second passes', async () => {
      await page.clock.runFor(RESIZED_QUEUE_SECONDS * SECOND_MS)
      await expectElapsedAtTick(
        page,
        (QUEUE_BUILDING_SECONDS + RESIZED_QUEUE_SECONDS) * TICKS_PER_SECOND,
      )
    })

    await test.step('Then the Human lane shows Pending Review 26 and Pending LOC 9,100', async () => {
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
  })

  // @wip: Step 8.5
  test.fixme('A drained queue shows no wait', async ({ page }) => {
    const HUMAN_GEN_LABEL = 'Human generation (PRs/hr)'

    await test.step('Given I set "Human generation (PRs/hr)" to 10 and the simulation has run for 2 seconds', async () => {
      await openSimulator(page)
      await setSlider(page, HUMAN_GEN_LABEL, BUSY_HUMAN_GEN)
      await startAndRunFor(page, QUEUE_BUILDING_SECONDS)
    })

    await test.step('When I set "Human generation (PRs/hr)" to 1 and "Reviewer speed (LOC/hr, both lanes)" to 1000', async () => {
      await setSlider(page, HUMAN_GEN_LABEL, QUIET_HUMAN_GEN)
      await setSlider(page, REVIEWER_SPEED_LABEL, FAST_REVIEWER_SPEED)
    })

    await test.step('And 6 seconds pass', async () => {
      await page.clock.runFor(DRAIN_SECONDS * SECOND_MS)
      await expectElapsedAtTick(page, (QUEUE_BUILDING_SECONDS + DRAIN_SECONDS) * TICKS_PER_SECOND)
    })

    await test.step('Then the Human lane shows Pending Review 0, Pickup wait 0.0 h, and Defects caught 6%', async () => {
      await expectMetric(page, 'human', 'pending', 0)
      await expectMetric(page, 'human', 'pickupWait', NO_WAIT)
      await expectMetric(page, 'human', 'defectsCaught', REFERENCE.humanDefectsCaughtWhenDrained)
    })
  })

  test('Incidents never decrease while running', async ({ page }) => {
    await test.step('Given I press Start', async () => {
      await openSimulator(page)
      await startSimulation(page)
    })

    await test.step("Then each lane's Incidents count, sampled every tick for 10 seconds, never decreases", async () => {
      const samples = await sampleEachTick(page, {
        startTick: 0,
        tickCount: FULL_RUN_SECONDS * TICKS_PER_SECOND,
        read: () => metricValues(page, 'incidents'),
      })

      expectNeverDecreases(samples)
      expect(samples.at(-1).ai).toBeGreaterThan(0)
    })
  })

  // @wip: Step 8.5
  test.fixme('Reset clears the metrics', async ({ page }) => {
    await test.step('Given the simulation has run for 10 seconds', async () => {
      await openSimulator(page)
      await startAndRunFor(page, FULL_RUN_SECONDS)
      await expect(headline(page)).toHaveText(REFERENCE.headlineRatioAtTick100)
    })

    await test.step('When I press Reset', async () => {
      await buttonNamed(page, 'Reset').click()
    })

    await test.step('Then both lanes show Incidents 0, Incidents per PR "—", and Pickup wait 0.0 h', async () => {
      await expectNoLaneIncidents(page)
    })

    await test.step('And the headline ratio shows "—"', async () => {
      await expectNoHeadlineRatio(page)
    })
  })
})
