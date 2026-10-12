import {
  AI_CODE_WRITTEN_LABEL,
  BUSY_AI_PRESET,
  HUMAN_PRS_PER_DAY_LABEL,
  REFERENCE,
  SECOND_MS,
  buttonNamed,
  expect,
  expectCounts,
  expectElapsedAtTick,
  expectEmptyLanes,
  flushPendingRenders,
  openWithSliders,
  openSimulator,
  pauseSimulation,
  slider,
  startAndRunFor,
  tabTo,
  test,
  expectLiveIntervals,
} from './fixtures.js'

const KEPT_AI_CODE_WRITTEN = 400
const KEPT_HUMAN_PRS_PER_DAY = 2
const KEPT_SETTINGS = Object.freeze({
  [AI_CODE_WRITTEN_LABEL]: KEPT_AI_CODE_WRITTEN,
  [HUMAN_PRS_PER_DAY_LABEL]: KEPT_HUMAN_PRS_PER_DAY,
})
const LONG_RUN_SECONDS = 3
const SHORT_RUN_SECONDS = 1
const IDLE_AFTER_RESET_SECONDS = 5
const NO_ELAPSED_TICKS = 0

const resetButton = (page) => buttonNamed(page, 'Reset')

// The defaults leave both queues empty, so a run that gives a Reset something to clear uses the
// busy-AI preset: after 1 s the AI lane shows 3 pending PRs and 1 deployed.
const expectBusyAiShortRunCounts = (page) =>
  expectCounts(page, 'ai', {
    pending: REFERENCE.busyAiPendingAtTick10,
    deployed: REFERENCE.busyAiDeployedAtTick10,
  })

test.describe.configure({ mode: 'parallel' })

test.describe('Reset the simulation', () => {
  test('Reset while running clears lanes and elapsed time, pauses, and keeps settings', async ({
    page,
  }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 400 and "Human PRs per day" to 2', async () => {
      await openWithSliders(page, KEPT_SETTINGS)
    })

    await test.step('And the simulation is running and has run for 3 seconds', async () => {
      await startAndRunFor(page, LONG_RUN_SECONDS)
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

    await test.step('And "AI code written (LOC/hr)" has value 400 and "Human PRs per day" has value 2', async () => {
      await expect(slider(page, AI_CODE_WRITTEN_LABEL)).toHaveValue(String(KEPT_AI_CODE_WRITTEN))
      await expect(slider(page, HUMAN_PRS_PER_DAY_LABEL)).toHaveValue(
        String(KEPT_HUMAN_PRS_PER_DAY),
      )
      await expect(resetButton(page)).toBeFocused()
    })
  })

  test('Reset while paused with non-zero counts clears them', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation ran for 3 seconds and was paused', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, LONG_RUN_SECONDS)
      await pauseSimulation(page)
    })

    await test.step('And the AI lane shows Pending Review 11 and Deployed 4', async () => {
      await expectCounts(page, 'ai', {
        pending: REFERENCE.busyAiPendingAtTick30,
        deployed: REFERENCE.busyAiDeployedAtTick30,
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
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, SHORT_RUN_SECONDS)
      await expectBusyAiShortRunCounts(page)
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
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and pressed Reset', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await resetButton(page).click()
    })

    await test.step('When I press Start and 1 second passes', async () => {
      await startAndRunFor(page, SHORT_RUN_SECONDS)
    })

    await test.step('Then the AI lane shows Pending Review 3 and Deployed 1', async () => {
      await expectBusyAiShortRunCounts(page)
    })
  })

  test('Reset is keyboard operable', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 1 second', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, SHORT_RUN_SECONDS)
      await expectBusyAiShortRunCounts(page)
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
