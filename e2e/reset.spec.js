import {
  REFERENCE,
  SECOND_MS,
  expect,
  expectCounts,
  openSimulator,
  pauseSimulation,
  setSlider,
  slider,
  startSimulation,
  tabTo,
  test,
  toggleButton,
} from './fixtures.js'

const AI_GEN = 'AI generation (PRs/hr)'
const PR_SIZE = 'PR size (LOC, both lanes)'
const CUSTOM_AI_GEN = 40
const CUSTOM_PR_SIZE = 300
const LANE_IDS = ['human', 'ai']

const resetButton = (page) => toggleButton(page, 'Reset')

const expectEmptyLanes = async (page) => {
  for (const laneId of LANE_IDS) {
    await expectCounts(page, laneId, { pending: 0, deployed: 0 })
  }
}

const runFor = async (page, seconds) => {
  await startSimulation(page)
  await page.clock.runFor(seconds * SECOND_MS)
}

test.describe('Reset the simulation', () => {
  test('Reset while running clears lanes and elapsed time, pauses, and keeps settings', async ({
    page,
  }) => {
    await openSimulator(page)
    await setSlider(page, AI_GEN, CUSTOM_AI_GEN)
    await setSlider(page, PR_SIZE, CUSTOM_PR_SIZE)
    await runFor(page, 3)

    await resetButton(page).click()

    await expectEmptyLanes(page)
    await expect(page.getByText('0.0 work hours', { exact: true })).toBeVisible()
    await expect(toggleButton(page, 'Start')).toBeVisible()
    await expect(slider(page, AI_GEN)).toHaveValue(String(CUSTOM_AI_GEN))
    await expect(slider(page, PR_SIZE)).toHaveValue(String(CUSTOM_PR_SIZE))
  })

  test('Reset while paused with non-zero counts clears them', async ({ page }) => {
    await openSimulator(page)
    await runFor(page, 3)
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
    await runFor(page, 1)
    await resetButton(page).click()
    await expectEmptyLanes(page)

    await page.clock.runFor(5 * SECOND_MS)

    await expectEmptyLanes(page)
  })

  test('Reset on a fresh page changes nothing', async ({ page }) => {
    await openSimulator(page)

    await resetButton(page).click()

    await expectEmptyLanes(page)
    await expect(toggleButton(page, 'Start')).toBeVisible()
  })

  test('Start after Reset runs from zero with the kept settings', async ({ page }) => {
    await openSimulator(page)
    await setSlider(page, AI_GEN, CUSTOM_AI_GEN)
    await resetButton(page).click()

    await runFor(page, 1)

    await expectCounts(page, 'ai', {
      pending: REFERENCE.aiPendingAtTick10WithAiGen40,
      deployed: REFERENCE.aiDeployedAtTick10WithAiGen40,
    })
  })

  test('Reset is keyboard operable', async ({ page }) => {
    await openSimulator(page)
    await runFor(page, 1)

    await tabTo(page, resetButton(page))
    await page.keyboard.press('Enter')

    await expectEmptyLanes(page)
  })
})
