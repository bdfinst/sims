import {
  expect,
  expectCounts,
  laneLocator,
  metric,
  openSimulator,
  pauseSimulation,
  startSimulation,
  test,
  toggleButton,
} from './fixtures.js'

const SECOND_MS = 1000
const TICK_MS = 100
const KEY_PRESSES_TO_REACH_BOUND = 200
const MAX_TABS_TO_REACH_A_CONTROL = 15

const HUMAN_GEN = 'Human generation (PRs/hr)'
const AI_GEN = 'AI generation (PRs/hr)'
const PR_SIZE = 'PR size (LOC, both lanes)'
const REVIEWER_SPEED = 'Reviewer speed (LOC/hr, both lanes)'
const AI_SKIM = 'AI skim multiplier'

const slider = (page, name) => page.getByRole('slider', { name, exact: true })
const setSlider = (page, name, value) => slider(page, name).fill(String(value))
const visibleValue = (sliderLocator) => sliderLocator.locator('xpath=..').locator('output')
const pendingCount = async (page, laneId) =>
  Number(await metric(page, laneId, 'pending').textContent())

const tabTo = async (page, target) => {
  for (let presses = 0; presses < MAX_TABS_TO_REACH_A_CONTROL; presses += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error('Tab never reached the control')
}

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
  },
  { control: AI_SKIM, defaultValue: 2, min: 1, max: 3, step: 0.5, shown: '2×', spoken: '2 times' },
]

const BOUNDS = [
  { control: AI_GEN, key: 'ArrowRight', bound: 50 },
  { control: AI_GEN, key: 'ArrowLeft', bound: 5 },
  { control: REVIEWER_SPEED, key: 'ArrowLeft', bound: 100 },
  { control: AI_SKIM, key: 'ArrowRight', bound: 3 },
]

test.describe('Adjust the model live', () => {
  for (const { control, defaultValue, min, max, step, shown, spoken } of DEFAULT_CONTROLS) {
    test(`Controls start at their defaults with units: ${control}`, async ({ page }) => {
      await openSimulator(page)

      const control_ = slider(page, control)
      await expect(control_).toHaveValue(String(defaultValue))
      await expect(control_).toHaveAttribute('min', String(min))
      await expect(control_).toHaveAttribute('max', String(max))
      await expect(control_).toHaveAttribute('step', String(step))
      await expect(visibleValue(control_)).toHaveText(shown)
      await expect(control_).toHaveAttribute('aria-valuetext', spoken)
    })
  }

  test('AI PR size and effective speed are derived and read-only', async ({ page }) => {
    await openSimulator(page)
    const aiLane = laneLocator(page, 'ai')

    const derivedSize = aiLane.locator('p', { hasText: 'PR size 378 LOC' })
    const derivedSpeed = aiLane.locator('p', { hasText: 'Effective speed 600 LOC/hr' })
    await expect(derivedSize).toContainText('derived')
    await expect(derivedSpeed).toContainText('derived')
    await expect(aiLane.getByRole('slider')).toHaveCount(2)
    await expect(aiLane.getByRole('slider', { name: AI_GEN })).toBeVisible()
    await expect(aiLane.getByRole('slider', { name: AI_SKIM })).toBeVisible()

    await setSlider(page, PR_SIZE, 200)
    await setSlider(page, AI_SKIM, 3)

    await expect(aiLane.locator('p', { hasText: 'PR size 302 LOC' })).toBeVisible()
    await expect(aiLane.locator('p', { hasText: 'Effective speed 900 LOC/hr' })).toBeVisible()
  })

  for (const { control, key, bound } of BOUNDS) {
    test(`Sliders stop at their bounds: ${key} on ${control}`, async ({ page }) => {
      await openSimulator(page)
      const control_ = slider(page, control)

      await control_.focus()
      for (let presses = 0; presses < KEY_PRESSES_TO_REACH_BOUND; presses += 1) {
        await control_.press(key)
      }

      await expect(control_).toHaveValue(String(bound))
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
    await expect(metric(page, 'ai', 'pending')).toHaveText('18')

    await setSlider(page, AI_GEN, 50)
    await expect(metric(page, 'ai', 'pending')).toHaveText('18')

    await startSimulation(page)
    await page.clock.runFor(TICK_MS)
    await expect(metric(page, 'ai', 'pending')).toHaveText('23')
  })

  test('A backlog drains to zero and never below', async ({ page }) => {
    await openSimulator(page)
    await setSlider(page, HUMAN_GEN, 10)
    await startSimulation(page)
    await page.clock.runFor(2 * SECOND_MS)
    await expectCounts(page, 'human', { pending: 17, deployed: 2 })

    await setSlider(page, HUMAN_GEN, 1)
    await setSlider(page, REVIEWER_SPEED, 1000)
    const sampledPending = []
    for (let tickIndex = 0; tickIndex < (6 * SECOND_MS) / TICK_MS; tickIndex += 1) {
      await page.clock.runFor(TICK_MS)
      sampledPending.push(await pendingCount(page, 'human'))
    }

    await expect(metric(page, 'human', 'pending')).toHaveText('0')
    expect(Math.min(...sampledPending)).toBeGreaterThanOrEqual(0)
  })

  test('Sliders are keyboard operable', async ({ page }) => {
    await openSimulator(page)
    const speed = slider(page, REVIEWER_SPEED)

    await tabTo(page, speed)
    await page.keyboard.press('ArrowRight')

    await expect(speed).toHaveValue('350')
    await expect(visibleValue(speed)).toHaveText('350 LOC/hr')
  })
})
