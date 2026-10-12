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

test.describe('Reset the simulation', () => {
  test('Reset while running clears lanes and elapsed time, pauses, and keeps settings', async ({
    page,
  }) => {
    await openSimulator(page)
    await setSlider(page, AI_GEN_LABEL, CUSTOM_AI_GEN)
    await setSlider(page, PR_SIZE_LABEL, CUSTOM_PR_SIZE)
    await startAndRunFor(page, LONG_RUN_SECONDS)
    await expectCounts(page, 'ai', {
      pending: REFERENCE.aiPendingAtTick30WithAiGen40AndPrSize300,
      deployed: REFERENCE.aiDeployedAtTick30WithAiGen40AndPrSize300,
    })

    await resetButton(page).click()

    await expectEmptyLanes(page)
    await expectElapsedAtTick(page, NO_ELAPSED_TICKS)
    await expect(buttonNamed(page, 'Start')).toBeVisible()
    await expect(slider(page, AI_GEN_LABEL)).toHaveValue(String(CUSTOM_AI_GEN))
    await expect(slider(page, PR_SIZE_LABEL)).toHaveValue(String(CUSTOM_PR_SIZE))
    await expect(resetButton(page)).toBeFocused()
  })

  test('Reset while paused with non-zero counts clears them', async ({ page }) => {
    await openSimulator(page)
    await startAndRunFor(page, LONG_RUN_SECONDS)
    await pauseSimulation(page)
    await expectCounts(page, 'ai', {
      pending: REFERENCE.aiPendingAtTick30,
      deployed: REFERENCE.aiDeployedAtTick30,
    })

    await resetButton(page).click()

    await expectEmptyLanes(page)
  })

  test('Counts stay at zero after Reset', async ({ page }) => {
    await openSimulator(page)
    await startAndRunFor(page, SHORT_RUN_SECONDS)
    await expectDefaultShortRunCounts(page)
    await resetButton(page).click()
    await expectEmptyLanes(page)

    await page.clock.runFor(IDLE_AFTER_RESET_SECONDS * SECOND_MS)
    await flushPendingRenders(page)

    await expectElapsedAtTick(page, NO_ELAPSED_TICKS)
    await expectEmptyLanes(page)
  })

  test('Reset on a fresh page changes nothing', async ({ page }) => {
    await openSimulator(page)

    await resetButton(page).click()

    await expectEmptyLanes(page)
    await expect(buttonNamed(page, 'Start')).toBeVisible()
  })

  test('Start after Reset runs from zero with the kept settings', async ({ page }) => {
    await openSimulator(page)
    await setSlider(page, AI_GEN_LABEL, CUSTOM_AI_GEN)
    await resetButton(page).click()

    await startAndRunFor(page, SHORT_RUN_SECONDS)

    await expectCounts(page, 'ai', {
      pending: REFERENCE.aiPendingAtTick10WithAiGen40,
      deployed: REFERENCE.aiDeployedAtTick10WithAiGen40,
    })
  })

  test('Reset is keyboard operable', async ({ page }) => {
    await openSimulator(page)
    await startAndRunFor(page, SHORT_RUN_SECONDS)
    await expectDefaultShortRunCounts(page)

    await tabTo(page, resetButton(page))
    await page.keyboard.press('Enter')

    await expectEmptyLanes(page)
  })
})
