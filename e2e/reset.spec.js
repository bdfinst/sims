import {
  AI_GEN_LABEL,
  PR_SIZE_LABEL,
  REFERENCE,
  SECOND_MS,
  buttonNamed,
  expect,
  expectCounts,
  expectElapsedAtTick,
  expectEmptyLanes,
  flushPendingRenders,
  openSimulator,
  pauseSimulation,
  setSlider,
  slider,
  startAndRunFor,
  tabTo,
  test,
  expectLiveIntervals,
} from './fixtures.js'

const CUSTOM_AI_GEN = 40
const CUSTOM_PR_SIZE = 300
const LONG_RUN_SECONDS = 3
const SHORT_RUN_SECONDS = 1
const IDLE_AFTER_RESET_SECONDS = 5
const NO_ELAPSED_TICKS = 0

const resetButton = (page) => buttonNamed(page, 'Reset')

// After one default second the AI queue is visibly non-empty, so a Reset has something to clear.
const expectDefaultShortRunCounts = (page) =>
  expectCounts(page, 'ai', {
    pending: REFERENCE.aiPendingAtTick10,
    deployed: REFERENCE.aiDeployedAtTick10,
  })

test.describe.configure({ mode: 'parallel' })

test.describe('Reset the simulation', () => {
  test('Reset while running clears lanes and elapsed time, pauses, and keeps settings', async ({
    page,
  }) => {
    await test.step('Given I set "AI generation (PRs/hr)" to 40 and "PR size (LOC, both lanes)" to 300', async () => {
      await openSimulator(page)
      await setSlider(page, AI_GEN_LABEL, CUSTOM_AI_GEN)
      await setSlider(page, PR_SIZE_LABEL, CUSTOM_PR_SIZE)
    })

    await test.step('And the simulation is running and has run for 3 seconds', async () => {
      await startAndRunFor(page, LONG_RUN_SECONDS)
      await expectCounts(page, 'ai', {
        pending: REFERENCE.aiPendingAtTick30WithAiGen40AndPrSize300,
        deployed: REFERENCE.aiDeployedAtTick30WithAiGen40AndPrSize300,
      })
    })

    await test.step('When I press Reset', async () => {
      await resetButton(page).click()
    })

    await test.step('Then both lanes show Pending Review 0 and Deployed 0', async () => {
      await expectEmptyLanes(page)
    })

    await test.step('And the elapsed readout shows "0.0 work hours"', async () => {
      await expectElapsedAtTick(page, NO_ELAPSED_TICKS)
    })

    await test.step('And the Start/Pause button reads "Start"', async () => {
      await expect(buttonNamed(page, 'Start')).toBeVisible()
      // Plan, Step 1.2 REFACTOR: Reset pauses, so the interval is cleared.
      await expectLiveIntervals(page, 0)
    })

    await test.step('And "AI generation (PRs/hr)" has value 40 and "PR size (LOC, both lanes)" has value 300', async () => {
      await expect(slider(page, AI_GEN_LABEL)).toHaveValue(String(CUSTOM_AI_GEN))
      await expect(slider(page, PR_SIZE_LABEL)).toHaveValue(String(CUSTOM_PR_SIZE))
      await expect(resetButton(page)).toBeFocused()
    })
  })

  test('Reset while paused with non-zero counts clears them', async ({ page }) => {
    await test.step('Given the simulation ran for 3 seconds and was paused', async () => {
      await openSimulator(page)
      await startAndRunFor(page, LONG_RUN_SECONDS)
      await pauseSimulation(page)
      await expectCounts(page, 'ai', {
        pending: REFERENCE.aiPendingAtTick30,
        deployed: REFERENCE.aiDeployedAtTick30,
      })
    })

    await test.step('When I press Reset', async () => {
      await resetButton(page).click()
    })

    await test.step('Then both lanes show Pending Review 0 and Deployed 0', async () => {
      await expectEmptyLanes(page)
    })
  })

  test('Counts stay at zero after Reset', async ({ page }) => {
    await test.step('Given I pressed Reset while running', async () => {
      await openSimulator(page)
      await startAndRunFor(page, SHORT_RUN_SECONDS)
      await expectDefaultShortRunCounts(page)
      await resetButton(page).click()
      await expectEmptyLanes(page)
    })

    await test.step('When 5 seconds pass', async () => {
      await page.clock.runFor(IDLE_AFTER_RESET_SECONDS * SECOND_MS)
      await flushPendingRenders(page)
    })

    await test.step('Then both lanes still show Pending Review 0 and Deployed 0', async () => {
      await expectElapsedAtTick(page, NO_ELAPSED_TICKS)
      await expectEmptyLanes(page)
    })
  })

  test('Reset on a fresh page changes nothing', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I press Reset', async () => {
      await resetButton(page).click()
    })

    await test.step('Then both lanes show Pending Review 0 and Deployed 0 and the Start/Pause button reads "Start"', async () => {
      await expectEmptyLanes(page)
      await expect(buttonNamed(page, 'Start')).toBeVisible()
    })
  })

  test('Start after Reset runs from zero with the kept settings', async ({ page }) => {
    await test.step('Given I set "AI generation (PRs/hr)" to 40 and pressed Reset', async () => {
      await openSimulator(page)
      await setSlider(page, AI_GEN_LABEL, CUSTOM_AI_GEN)
      await resetButton(page).click()
    })

    await test.step('When I press Start and 1 second passes', async () => {
      await startAndRunFor(page, SHORT_RUN_SECONDS)
    })

    await test.step('Then the AI lane shows Pending Review 38 and Deployed 1', async () => {
      await expectCounts(page, 'ai', {
        pending: REFERENCE.aiPendingAtTick10WithAiGen40,
        deployed: REFERENCE.aiDeployedAtTick10WithAiGen40,
      })
    })
  })

  test('Reset is keyboard operable', async ({ page }) => {
    await test.step('Given the simulation has run for 1 second', async () => {
      await openSimulator(page)
      await startAndRunFor(page, SHORT_RUN_SECONDS)
      await expectDefaultShortRunCounts(page)
    })

    await test.step('When I Tab to "Reset" and press Enter', async () => {
      await tabTo(page, resetButton(page))
      await page.keyboard.press('Enter')
    })

    await test.step('Then both lanes show Pending Review 0 and Deployed 0', async () => {
      await expectEmptyLanes(page)
    })
  })
})
