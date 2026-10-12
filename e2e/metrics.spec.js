import {
  AI_DRAIN_SETTINGS,
  AI_SKIM_LABEL,
  ALL_LANE_IDS,
  BUSY_AI_PRESET,
  HUMAN_CODE_WRITTEN_LABEL,
  HUMAN_PRS_PER_DAY_LABEL,
  NEXT_TICK_SECONDS,
  NO_VALUE,
  REFERENCE,
  REVIEWER_SPEED_LABEL,
  TICKS_PER_SECOND,
  buttonNamed,
  expect,
  expectCounts,
  expectDeployed,
  expectDefectsCaught,
  expectNeverDecreases,
  expectPending,
  headline,
  laneLocator,
  metric,
  metricValues,
  openWithSliders,
  openSimulator,
  pauseSimulation,
  runFor,
  sampleEachTick,
  setSliders,
  startAndRunFor,
  startSimulation,
  test,
  FULL_RUN_SECONDS,
  DRAIN_SECONDS,
} from './fixtures.js'

// Plan, Slice 4 outlines: Human code written and PRs per day set the derived PR size.
const SIZE_CASES = [
  { loc: 25, perDay: 4, size: '50', caught: '80%' },
  { loc: 25, perDay: 1, size: '200', caught: '80%' },
  { loc: 75, perDay: 2, size: '300', caught: '42%' },
  { loc: 50, perDay: 1, size: '400', caught: '4%' },
  { loc: 125, perDay: 1, size: '1,000', caught: '4%' },
]

const SPEED_CASES = [
  { speed: 500, caught: '80%' },
  { speed: 750, caught: '44%' },
  { speed: 900, caught: '22%' },
  { speed: 1000, caught: '8%' },
]

// 25 LOC/hr at 1 PR per day is a 200 LOC PR, the knee of the size curve.
const CODE_WRITTEN_AT_SIZE_KNEE = 25
const HUMAN_CAUGHT_AT_REST = '65%'
const AI_CAUGHT_AT_REST = '15%'
const AI_CAUGHT_AT_MAX_SKIM = '5%'
const AI_CAUGHT_AT_HUMAN_PACE = '18%'
const MAX_SKIM = 3
const HUMAN_PACE_SKIM = 1

const NO_WAIT = '0.0 h'
const CHANGE_AT_SECONDS = 1
const LARGE_PR_CODE_WRITTEN = 50
const RARE_PRS_PER_DAY = 0.25
const MID_RUN_REVIEWER_SPEED = 900
const QUEUE_BUILDING_SECONDS = 2
const HALVED_PRS_PER_DAY = 0.5
const RESIZED_QUEUE_SECONDS = 1
const RESEARCH_RATIO_FLOOR = 3
const RESEARCH_RATIO_CEILING = 4
const NEARLY_A_PR_SECONDS = 7.9
const REST_OF_RUN_SECONDS = 8.9
const UNAVAILABLE_TEXT = 'Not yet available'

// AC7c: from the defaults at 1 s, one Human-side change shows in Defects caught on the next tick
// and in the Human lane's metrics at 10 s.
const MID_RUN_CHANGES = [
  {
    scenario: 'A size change while running changes defects caught and accrual on the next tick',
    control: HUMAN_CODE_WRITTEN_LABEL,
    value: LARGE_PR_CODE_WRITTEN,
    caughtNextTick: REFERENCE.humanDefectsCaughtAfterCodeWritten50,
    atTenSeconds: {
      step: 'Then the Human lane shows Incidents 8 and Incidents per PR 7.08',
      shown: {
        incidents: REFERENCE.humanIncidentsAtTick100AfterCodeWritten50,
        incidentsPerPr: REFERENCE.humanIncidentsPerPrAtTick100AfterCodeWritten50,
      },
    },
  },
  {
    scenario:
      'A PR-frequency change while running changes defects caught and accrual on the next tick',
    control: HUMAN_PRS_PER_DAY_LABEL,
    value: RARE_PRS_PER_DAY,
    caughtNextTick: REFERENCE.humanDefectsCaughtAfterPrsPerDay025,
    atTenSeconds: {
      step: 'Then the Human lane shows Incidents 5, Deployed 0, and Incidents per PR "—"',
      shown: {
        incidents: REFERENCE.humanIncidentsAtTick100AfterPrsPerDay025,
        deployed: REFERENCE.humanDeployedAtTick100AfterPrsPerDay025,
        incidentsPerPr: NO_VALUE,
      },
    },
  },
  {
    scenario:
      'A reviewer-speed change while running changes defects caught and accrual on the next tick',
    control: REVIEWER_SPEED_LABEL,
    value: MID_RUN_REVIEWER_SPEED,
    caughtNextTick: REFERENCE.humanDefectsCaughtAfterReviewerSpeed900,
    atTenSeconds: {
      step: 'Then the Human lane shows Incidents 4 and Incidents per PR 3.71',
      shown: {
        incidents: REFERENCE.humanIncidentsAtTick100AfterReviewerSpeed900,
        incidentsPerPr: REFERENCE.humanIncidentsPerPrAtTick100AfterReviewerSpeed900,
      },
    },
  },
]

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

  for (const { loc, perDay, size, caught } of SIZE_CASES) {
    test(`Defects caught follows PR size: ${loc} LOC/hr at ${perDay} PRs per day gives ${caught}`, async ({
      page,
    }) => {
      await test.step(`Given I set "Human code written (LOC/hr)" to ${loc} and "Human PRs per day" to ${perDay}`, async () => {
        await openWithSliders(page, {
          [HUMAN_CODE_WRITTEN_LABEL]: loc,
          [HUMAN_PRS_PER_DAY_LABEL]: perDay,
        })
      })

      await test.step(`Then the Human lane shows "PR size ${size} LOC (derived)" and Defects caught ${caught}`, async () => {
        await expect(
          laneLocator(page, 'human').getByText(`PR size ${size} LOC (derived)`),
        ).toBeVisible()
        await expectDefectsCaught(page, 'human', caught)
      })
    })
  }

  for (const { speed, caught } of SPEED_CASES) {
    test(`Defects caught follows reviewer speed: ${speed} LOC/hr gives ${caught}`, async ({
      page,
    }) => {
      await test.step(`Given I set "Human code written (LOC/hr)" to ${CODE_WRITTEN_AT_SIZE_KNEE} and "Reviewer speed (LOC/hr, both lanes)" to ${speed}`, async () => {
        await openWithSliders(page, {
          [HUMAN_CODE_WRITTEN_LABEL]: CODE_WRITTEN_AT_SIZE_KNEE,
          [REVIEWER_SPEED_LABEL]: speed,
        })
      })

      await test.step(`Then the Human lane shows Defects caught ${caught}`, async () => {
        await expectDefectsCaught(page, 'human', caught)
      })
    })
  }

  test('Skimming harder lowers AI defects caught', async ({ page }) => {
    await test.step('Given I set "AI skim multiplier" to 3', async () => {
      await openWithSliders(page, { [AI_SKIM_LABEL]: MAX_SKIM })
    })

    await test.step('Then the AI lane shows Defects caught 5%', async () => {
      await expectDefectsCaught(page, 'ai', AI_CAUGHT_AT_MAX_SKIM)
    })
  })

  test('Reviewing AI code at human pace restores some catching', async ({ page }) => {
    await test.step('Given I set "AI skim multiplier" to 1', async () => {
      await openWithSliders(page, { [AI_SKIM_LABEL]: HUMAN_PACE_SKIM })
    })

    await test.step('Then the AI lane shows Defects caught 18%', async () => {
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

  test('Default metrics after 10 seconds', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I press Start and 10 seconds pass', async () => {
      await startAndRunFor(page, FULL_RUN_SECONDS)
    })

    await test.step('Then the Human lane shows Incidents 2, Incidents per PR 1.69, Pickup wait 0.0 h', async () => {
      await expectMetric(page, 'human', 'incidents', REFERENCE.defaultHumanIncidentsAtTick100)
      await expectMetric(page, 'human', 'incidentsPerPr', REFERENCE.defaultHumanIncidentsPerPr)
      await expectMetric(page, 'human', 'pickupWait', NO_WAIT)
    })

    await test.step('And the AI lane shows Incidents 9, Incidents per PR 6.16, Pickup wait 0.0 h, Pending LOC 0', async () => {
      await expectMetric(page, 'ai', 'incidents', REFERENCE.defaultAiIncidentsAtTick100)
      await expectMetric(page, 'ai', 'incidentsPerPr', REFERENCE.defaultAiIncidentsPerPr)
      await expectMetric(page, 'ai', 'pickupWait', NO_WAIT)
      await expectMetric(page, 'ai', 'pendingLoc', 0)
    })

    await test.step('And the headline ratio shows "3.65×"', async () => {
      await expect(headline(page)).toHaveText(REFERENCE.defaultHeadlineRatio)
    })
  })

  test('The research effect emerges at the defaults', async ({ page }) => {
    await test.step('Given the simulation is running and has run for 10 seconds with defaults', async () => {
      await openSimulator(page)
      await startAndRunFor(page, FULL_RUN_SECONDS)
    })

    await test.step('Then the headline ratio is between 3 and 4', async () => {
      const ratio = Number.parseFloat(await headline(page).textContent())
      expect(ratio).toBeGreaterThan(RESEARCH_RATIO_FLOOR)
      expect(ratio).toBeLessThan(RESEARCH_RATIO_CEILING)
    })
  })

  test('Incidents per PR waits for a whole deployed PR', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I press Start and 7.9 seconds pass', async () => {
      await startAndRunFor(page, NEARLY_A_PR_SECONDS)
    })

    await test.step('Then the Human lane shows Deployed 0 and Incidents per PR "—"', async () => {
      await expectDeployed(page, 'human', REFERENCE.defaultHumanDeployedAtTick79)
      await expectMetric(page, 'human', 'incidentsPerPr', NO_VALUE)
    })

    await test.step('And the headline ratio shows "—"', async () => {
      await expectNoHeadlineRatio(page)
    })

    await test.step('When 0.1 more seconds pass', async () => {
      await runFor(page, NEXT_TICK_SECONDS)
    })

    await test.step('Then the Human lane shows Deployed 1 and Incidents per PR 1.69', async () => {
      await expectDeployed(page, 'human', REFERENCE.defaultHumanDeployedAtTick80)
      await expectMetric(page, 'human', 'incidentsPerPr', REFERENCE.defaultHumanIncidentsPerPr)
    })
  })

  test('Larger PRs accrue more incidents', async ({ page }) => {
    await test.step('Given I set "Human code written (LOC/hr)" to 50', async () => {
      await openWithSliders(page, { [HUMAN_CODE_WRITTEN_LABEL]: LARGE_PR_CODE_WRITTEN })
    })

    await test.step('When I press Start and 10 seconds pass', async () => {
      await startAndRunFor(page, FULL_RUN_SECONDS)
    })

    await test.step('Then the Human lane shows Pending Review 0, Deployed 1, Incidents 9, and Incidents per PR 7.68', async () => {
      await expectCounts(page, 'human', {
        pending: REFERENCE.largeHumanPrPendingAtTick100,
        deployed: REFERENCE.largeHumanPrDeployedAtTick100,
      })
      await expectMetric(page, 'human', 'incidents', REFERENCE.largeHumanPrIncidentsAtTick100)
      await expectMetric(
        page,
        'human',
        'incidentsPerPr',
        REFERENCE.largeHumanPrIncidentsPerPrAtTick100,
      )
    })
  })

  for (const { scenario, control, value, caughtNextTick, atTenSeconds } of MID_RUN_CHANGES) {
    test(scenario, async ({ page }) => {
      await test.step('Given the simulation is running and has run for 1 second with defaults', async () => {
        await openSimulator(page)
        await startAndRunFor(page, CHANGE_AT_SECONDS)
      })

      await test.step(`When I set "${control}" to ${value}`, async () => {
        await setSliders(page, { [control]: value })
      })

      await test.step('And 0.1 seconds pass', async () => {
        await runFor(page, NEXT_TICK_SECONDS)
      })

      await test.step(`Then the Human lane shows Defects caught ${caughtNextTick}`, async () => {
        await expectDefectsCaught(page, 'human', caughtNextTick)
      })

      await test.step('When 8.9 more seconds pass', async () => {
        await runFor(page, REST_OF_RUN_SECONDS)
      })

      await test.step(atTenSeconds.step, async () => {
        for (const [name, shown] of Object.entries(atTenSeconds.shown)) {
          await expectMetric(page, 'human', name, shown)
        }
      })
    })
  }

  test('Queued PRs keep their size when PR size changes', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 2 seconds', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, QUEUE_BUILDING_SECONDS)
    })

    await test.step('And the AI lane shows Pending Review 7 and Pending LOC 2,800', async () => {
      await expectPending(page, 'ai', REFERENCE.busyAiPendingAtTick20)
      await expectMetric(page, 'ai', 'pendingLoc', REFERENCE.busyAiPendingLocAtTick20)
    })

    await test.step('When I pause, set "Human PRs per day" to 0.5, and press Start', async () => {
      await pauseSimulation(page)
      await setSliders(page, { [HUMAN_PRS_PER_DAY_LABEL]: HALVED_PRS_PER_DAY })
      await startSimulation(page)
    })

    await test.step('And 1 second passes', async () => {
      await runFor(page, RESIZED_QUEUE_SECONDS)
    })

    await test.step('Then the AI lane shows Pending Review 9 and Pending LOC 4,200', async () => {
      await expectPending(page, 'ai', REFERENCE.busyAiPendingAtTick30AfterHumanPrsPerDay05)
      await expectMetric(
        page,
        'ai',
        'pendingLoc',
        REFERENCE.busyAiPendingLocAtTick30AfterHumanPrsPerDay05,
      )
    })
  })

  test('A drained queue shows no wait', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 2 seconds', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, QUEUE_BUILDING_SECONDS)
    })

    await test.step('When I set "AI code written (LOC/hr)" to 5 and "Reviewer speed (LOC/hr, both lanes)" to 1000', async () => {
      await setSliders(page, AI_DRAIN_SETTINGS)
    })

    await test.step('And 6 seconds pass', async () => {
      await runFor(page, DRAIN_SECONDS)
    })

    await test.step('Then the AI lane shows Pending Review 0, Pickup wait 0.0 h, and Defects caught 2%', async () => {
      await expectPending(page, 'ai', 0)
      await expectMetric(page, 'ai', 'pickupWait', NO_WAIT)
      await expectDefectsCaught(page, 'ai', REFERENCE.drainedAiDefectsCaught)
    })
  })

  test('Incidents never decrease while running', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and press Start', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
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

  test('Reset clears the metrics', async ({ page }) => {
    await test.step('Given the simulation is running and has run for 10 seconds', async () => {
      await openSimulator(page)
      await startAndRunFor(page, FULL_RUN_SECONDS)
      await expect(headline(page)).toHaveText(REFERENCE.defaultHeadlineRatio)
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
