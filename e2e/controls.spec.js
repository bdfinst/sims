import {
  REFERENCE,
  SECOND_MS,
  TICK_MS,
  expect,
  expectCounts,
  laneLocator,
  metric,
  metricValues,
  openSimulator,
  pauseSimulation,
  sampleEachTick,
  setSlider,
  slider,
  startSimulation,
  tabTo,
  test,
  toggleButton,
  visibleValue,
} from './fixtures.js'

const HUMAN_GEN = 'Human generation (PRs/hr)'
const AI_GEN = 'AI generation (PRs/hr)'
const PR_SIZE = 'PR size (LOC, both lanes)'
const REVIEWER_SPEED = 'Reviewer speed (LOC/hr, both lanes)'
const AI_SKIM = 'AI skim multiplier'

const DEFAULT_CONTROLS = [
  {
    control: HUMAN_GEN,
    defaultValue: 1,
    min: 1,
    max: 10,
    step: 1,
    shown: '1 PRs/hr',
    spoken: '1 PRs per hour',
  },
  {
    control: AI_GEN,
    defaultValue: 20,
    min: 5,
    max: 50,
    step: 1,
    shown: '20 PRs/hr',
    spoken: '20 PRs per hour',
  },
  {
    control: PR_SIZE,
    defaultValue: 250,
    min: 50,
    max: 1000,
    step: 10,
    shown: '250 LOC',
    spoken: '250 lines of code',
  },
  {
    control: REVIEWER_SPEED,
    defaultValue: 300,
    min: 100,
    max: 1000,
    step: 50,
    shown: '300 LOC/hr',
    spoken: '300 lines of code per hour',
  },
  { control: AI_SKIM, defaultValue: 2, min: 1, max: 3, step: 0.5, shown: '2×', spoken: '2 times' },
]

const BOUNDS = [
  { control: AI_GEN, key: 'End', bound: 50 },
  { control: AI_GEN, key: 'Home', bound: 5 },
  { control: REVIEWER_SPEED, key: 'Home', bound: 100 },
  { control: AI_SKIM, key: 'End', bound: 3 },
]

test.describe('Adjust the model live', () => {
  for (const { control, defaultValue, min, max, step, shown, spoken } of DEFAULT_CONTROLS) {
    test(`Controls start at their defaults with units: ${control}`, async ({ page }) => {
      await openSimulator(page)

      const sliderLocator = slider(page, control)
      await expect(sliderLocator).toHaveValue(String(defaultValue))
      await expect(sliderLocator).toHaveAttribute('min', String(min))
      await expect(sliderLocator).toHaveAttribute('max', String(max))
      await expect(sliderLocator).toHaveAttribute('step', String(step))
      await expect(await visibleValue(sliderLocator)).toHaveText(shown)
      await expect(sliderLocator).toHaveAttribute('aria-valuetext', spoken)
    })
  }

  test('AI PR size and effective speed are derived and read-only', async ({ page }) => {
    await openSimulator(page)
    const aiLane = laneLocator(page, 'ai')

    const derivedSize = aiLane.locator('p', {
      hasText: `PR size ${REFERENCE.aiPrSizeAtDefaults} LOC`,
    })
    const derivedSpeed = aiLane.locator('p', { hasText: 'Effective speed 600 LOC/hr' })
    await expect(derivedSize).toContainText('derived')
    await expect(derivedSpeed).toContainText('derived')
    await expect(aiLane.getByRole('slider')).toHaveCount(2)
    await expect(aiLane.getByRole('slider', { name: AI_GEN })).toBeVisible()
    await expect(aiLane.getByRole('slider', { name: AI_SKIM })).toBeVisible()

    await setSlider(page, PR_SIZE, 200)
    await setSlider(page, AI_SKIM, 3)

    await expect(
      aiLane.locator('p', { hasText: `PR size ${REFERENCE.aiPrSizeAtPrSize200} LOC` }),
    ).toBeVisible()
    await expect(aiLane.locator('p', { hasText: 'Effective speed 900 LOC/hr' })).toBeVisible()
  })

  for (const { control, key, bound } of BOUNDS) {
    test(`Sliders stop at their bounds: ${key} on ${control}`, async ({ page }) => {
      await openSimulator(page)
      const sliderLocator = slider(page, control)

      await sliderLocator.focus()
      await sliderLocator.press(key)

      await expect(sliderLocator).toHaveValue(String(bound))
    })
  }

  test('A review-side change applies on the next tick', async ({ page }) => {
    await openSimulator(page)
    await startSimulation(page)
    await page.clock.runFor(1 * SECOND_MS)
    await expect(metric(page, 'ai', 'deployed')).toHaveText('1')

    await setSlider(page, REVIEWER_SPEED, 1000)
    await setSlider(page, AI_SKIM, 3)
    await page.clock.runFor(TICK_MS)

    await expect(metric(page, 'ai', 'deployed')).toHaveText('2')
    await expect(toggleButton(page, 'Pause')).toBeVisible()
  })

  test('A change while paused takes effect only after Start', async ({ page }) => {
    await openSimulator(page)
    await startSimulation(page)
    await page.clock.runFor(1 * SECOND_MS)
    await pauseSimulation(page)
    await expect(metric(page, 'ai', 'pending')).toHaveText(String(REFERENCE.aiPendingAtTick10))

    await setSlider(page, AI_GEN, 50)
    await expect(metric(page, 'ai', 'pending')).toHaveText(String(REFERENCE.aiPendingAtTick10))

    await startSimulation(page)
    await page.clock.runFor(TICK_MS)
    await expect(metric(page, 'ai', 'pending')).toHaveText(
      String(REFERENCE.aiPendingAtTick11WithAiGen50),
    )
  })

  test('A backlog drains to zero and never below', async ({ page }) => {
    await openSimulator(page)
    await setSlider(page, HUMAN_GEN, 10)
    await startSimulation(page)
    await page.clock.runFor(2 * SECOND_MS)
    await expectCounts(page, 'human', { pending: 17, deployed: 2 })

    await setSlider(page, HUMAN_GEN, 1)
    await setSlider(page, REVIEWER_SPEED, 1000)
    const sampledPending = await sampleEachTick(page, {
      startTick: 20,
      tickCount: (6 * SECOND_MS) / TICK_MS,
      read: async () => (await metricValues(page, 'pending')).human,
    })

    await expect(metric(page, 'human', 'pending')).toHaveText('0')
    expect(Math.min(...sampledPending)).toBeGreaterThanOrEqual(0)
  })

  test('Sliders are keyboard operable', async ({ page }) => {
    await openSimulator(page)
    const reviewerSpeedSlider = slider(page, REVIEWER_SPEED)

    await tabTo(page, reviewerSpeedSlider)
    await page.keyboard.press('ArrowRight')

    await expect(reviewerSpeedSlider).toHaveValue('350')
    await expect(await visibleValue(reviewerSpeedSlider)).toHaveText('350 LOC/hr')
  })
})
