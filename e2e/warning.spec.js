import {
  HUMAN_GEN_LABEL,
  REFERENCE,
  REVIEWER_SPEED_LABEL,
  SECOND_MS,
  THRESHOLD_LABEL,
  TICKS_PER_SECOND,
  buttonNamed,
  expect,
  expectElapsedAtTick,
  laneLocator,
  metric,
  openSimulator,
  pauseSimulation,
  setSlider,
  slider,
  startAndRunFor,
  startSimulation,
  test,
} from './fixtures.js'

const WARNING_RED = 'rgb(239, 68, 68)'
const DEFAULT_THRESHOLD = 15
const MIN_THRESHOLD = 5
const MAX_THRESHOLD = 50
const THRESHOLD_STEP = 1
const BUSY_HUMAN_GEN = 10
const QUIET_HUMAN_GEN = 1
const FAST_REVIEWER_SPEED = 1000
const THRESHOLD_BETWEEN_LANES = 17 // Human shows 17, AI shows 36
const THRESHOLD_BELOW_BOTH_LANES = 16
const THRESHOLD_AT_AI_PENDING = 18
const RAISED_THRESHOLD = 25
const LOWEST_THRESHOLD = MIN_THRESHOLD
const KEPT_THRESHOLD = 30
const HALF_SECOND = 0.5
const TENTH_SECOND = 0.1
const RUN_FOR_AI_PENDING_22_SECONDS = 1.2
const NEARLY_WARNING_SECONDS = 0.8

const queueBox = (page, laneId) => laneLocator(page, laneId).locator('[data-state]')
const expectWarning = (page, laneId) =>
  expect(queueBox(page, laneId)).toHaveAttribute('data-state', 'warning')
const expectNoWarning = (page, laneId) =>
  expect(queueBox(page, laneId)).toHaveAttribute('data-state', 'normal')
const expectPending = (page, laneId, count) =>
  expect(metric(page, laneId, 'pending')).toHaveText(String(count))
const ticksAt = (seconds) => Math.round(seconds * TICKS_PER_SECOND)

test.describe('Pending Review overload warning', () => {
  test('AI queue turns red once it exceeds the default threshold', async ({ page }) => {
    await openSimulator(page)
    await startSimulation(page)

    await page.clock.runFor(NEARLY_WARNING_SECONDS * SECOND_MS)
    await expectElapsedAtTick(page, ticksAt(NEARLY_WARNING_SECONDS))
    await expectPending(page, 'ai', REFERENCE.aiPendingAtTick8)
    await expectNoWarning(page, 'ai')

    await page.clock.runFor(TENTH_SECOND * SECOND_MS)
    await expectElapsedAtTick(page, ticksAt(NEARLY_WARNING_SECONDS + TENTH_SECOND))
    await expectPending(page, 'ai', REFERENCE.aiPendingAtTick9)
    await expectWarning(page, 'ai')
    await expect(queueBox(page, 'ai').locator('[data-icon="triangle-alert"]')).toBeVisible()
    await expect(queueBox(page, 'ai')).toHaveCSS('border-color', WARNING_RED)
    await expect(laneLocator(page, 'ai').getByRole('status')).toHaveText(
      'AI Pending Review over threshold',
    )
    await expectNoWarning(page, 'human')
    await expect(queueBox(page, 'human').locator('[data-icon]')).toHaveCount(0)
    await expect(laneLocator(page, 'human').getByRole('status')).toHaveText('')
  })

  test('Each lane has exactly one status element, and counts are not live regions', async ({
    page,
  }) => {
    await openSimulator(page)

    await expect(laneLocator(page, 'ai').getByRole('status')).toHaveCount(1)
    await expect(laneLocator(page, 'human').getByRole('status')).toHaveCount(1)
    await expect(page.locator('[aria-live]')).toHaveCount(0)
  })

  test('Displayed value at the threshold is not a warning even if the internal value is above it', async ({
    page,
  }) => {
    await openSimulator(page)
    await setSlider(page, HUMAN_GEN_LABEL, BUSY_HUMAN_GEN)
    await startSimulation(page)

    await page.clock.runFor(1.8 * SECOND_MS)
    await expectElapsedAtTick(page, ticksAt(1.8))
    await expectPending(page, 'human', REFERENCE.humanPendingAtTick18WithHumanGen10)
    await expectNoWarning(page, 'human')

    await page.clock.runFor(TENTH_SECOND * SECOND_MS)
    await expectElapsedAtTick(page, ticksAt(1.9))
    await expectPending(page, 'human', REFERENCE.humanPendingAtTick19WithHumanGen10)
    await expectWarning(page, 'human')
  })

  test('A custom threshold applies to both lanes', async ({ page }) => {
    await openSimulator(page)
    await setSlider(page, HUMAN_GEN_LABEL, BUSY_HUMAN_GEN)
    await startAndRunFor(page, 2)
    await pauseSimulation(page)
    await expectPending(page, 'human', REFERENCE.humanPendingAtTick20WithHumanGen10)
    await expectPending(page, 'ai', REFERENCE.aiPendingAtTick20WithHumanGen10)

    await setSlider(page, THRESHOLD_LABEL, THRESHOLD_BETWEEN_LANES)
    await expectNoWarning(page, 'human')
    await expectWarning(page, 'ai')

    await setSlider(page, THRESHOLD_LABEL, THRESHOLD_BELOW_BOTH_LANES)
    await expectWarning(page, 'human')
    await expectWarning(page, 'ai')
  })

  test('Exactly at a custom threshold is not a warning', async ({ page }) => {
    await openSimulator(page)
    await setSlider(page, THRESHOLD_LABEL, THRESHOLD_AT_AI_PENDING)

    await startAndRunFor(page, 1)

    await expectPending(page, 'ai', REFERENCE.aiPendingAtTick10)
    await expectNoWarning(page, 'ai')
  })

  test('Raising the threshold while paused clears the warning', async ({ page }) => {
    await openSimulator(page)
    await startAndRunFor(page, RUN_FOR_AI_PENDING_22_SECONDS)
    await pauseSimulation(page)
    await expectPending(page, 'ai', REFERENCE.aiPendingAtTick12)
    await expectWarning(page, 'ai')

    await setSlider(page, THRESHOLD_LABEL, RAISED_THRESHOLD)

    await expectNoWarning(page, 'ai')
  })

  test('Lowering the threshold while running applies immediately', async ({ page }) => {
    await openSimulator(page)
    await startAndRunFor(page, HALF_SECOND)
    await expectPending(page, 'ai', REFERENCE.aiPendingAtTick5)
    await expectNoWarning(page, 'ai')

    await setSlider(page, THRESHOLD_LABEL, LOWEST_THRESHOLD)

    await expectWarning(page, 'ai')
    await expect(buttonNamed(page, 'Pause')).toBeVisible()
  })

  test('Warning clears when the queue drains to the threshold', async ({ page }) => {
    await openSimulator(page)
    await setSlider(page, HUMAN_GEN_LABEL, BUSY_HUMAN_GEN)
    await startAndRunFor(page, 2)
    await expectPending(page, 'human', REFERENCE.humanPendingAtTick20WithHumanGen10)
    await expectWarning(page, 'human')

    await setSlider(page, HUMAN_GEN_LABEL, QUIET_HUMAN_GEN)
    await setSlider(page, REVIEWER_SPEED_LABEL, FAST_REVIEWER_SPEED)
    await page.clock.runFor(HALF_SECOND * SECOND_MS)
    await expectElapsedAtTick(page, ticksAt(2 + HALF_SECOND))
    await expectPending(page, 'human', REFERENCE.humanPendingAtTick25AfterDraining)
    await expectWarning(page, 'human')

    await page.clock.runFor(TENTH_SECOND * SECOND_MS)
    await expectElapsedAtTick(page, ticksAt(2 + HALF_SECOND + TENTH_SECOND))
    await expectPending(page, 'human', REFERENCE.humanPendingAtTick26AfterDraining)
    await expectNoWarning(page, 'human')
  })

  test('Threshold slider default and bounds', async ({ page }) => {
    await openSimulator(page)

    const threshold = slider(page, THRESHOLD_LABEL)
    await expect(threshold).toHaveValue(String(DEFAULT_THRESHOLD))
    await expect(threshold).toHaveAttribute('min', String(MIN_THRESHOLD))
    await expect(threshold).toHaveAttribute('max', String(MAX_THRESHOLD))
    await expect(threshold).toHaveAttribute('step', String(THRESHOLD_STEP))
  })

  test('Reset keeps the threshold', async ({ page }) => {
    await openSimulator(page)
    await setSlider(page, THRESHOLD_LABEL, KEPT_THRESHOLD)

    await buttonNamed(page, 'Reset').click()

    await expect(slider(page, THRESHOLD_LABEL)).toHaveValue(String(KEPT_THRESHOLD))
  })
})
