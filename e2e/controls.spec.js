import {
  AI_CODE_WRITTEN_LABEL,
  AI_SKIM_LABEL,
  HUMAN_CODE_WRITTEN_LABEL,
  HUMAN_PRS_PER_DAY_LABEL,
  REVIEWER_SPEED_LABEL,
  REFERENCE,
  SECOND_MS,
  TICKS_PER_SECOND,
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
  buttonNamed,
  visibleValue,
  DRAIN_SECONDS,
} from './fixtures.js'

const DRAIN_START_SECONDS = 2

const DEFAULT_CONTROLS = [
  {
    control: HUMAN_CODE_WRITTEN_LABEL,
    defaultValue: 30,
    min: 5,
    max: 200,
    step: 5,
    shown: '30 LOC/hr',
    spoken: '30 lines of code per hour',
  },
  {
    control: HUMAN_PRS_PER_DAY_LABEL,
    defaultValue: 1,
    min: 0.25,
    max: 4,
    step: 0.25,
    shown: '1 PRs/day',
    spoken: '1 PRs per day',
  },
  {
    control: AI_CODE_WRITTEN_LABEL,
    defaultValue: 53,
    min: 5,
    max: 2000,
    step: 1,
    shown: '53 LOC/hr',
    spoken: '53 lines of code per hour',
  },
  {
    control: REVIEWER_SPEED_LABEL,
    defaultValue: 300,
    min: 100,
    max: 1000,
    step: 50,
    shown: '300 LOC/hr',
    spoken: '300 lines of code per hour',
  },
  {
    control: AI_SKIM_LABEL,
    defaultValue: 2,
    min: 1,
    max: 3,
    step: 0.5,
    shown: '2×',
    spoken: '2 times',
  },
]

const BOUNDS = [
  { control: REVIEWER_SPEED_LABEL, key: 'ArrowLeft', bound: 100 },
  { control: AI_SKIM_LABEL, key: 'ArrowRight', bound: 3 },
]
// The feature: "When I press <key> 200 times" (more than any slider's range in steps).
const KEY_PRESSES = 200

test.describe.configure({ mode: 'parallel' })

test.describe('Adjust the model live', () => {
  for (const { control, defaultValue, min, max, step, shown, spoken } of DEFAULT_CONTROLS) {
    test(`Controls start at their defaults with units: ${control}`, async ({ page }) => {
      const sliderLocator = slider(page, control)

      await test.step('Given I open the simulator', async () => {
        await openSimulator(page)
      })

      await test.step(`Then the "${control}" slider has value ${defaultValue}, min ${min}, max ${max}, and step ${step}`, async () => {
        await expect(sliderLocator).toHaveValue(String(defaultValue))
        await expect(sliderLocator).toHaveAttribute('min', String(min))
        await expect(sliderLocator).toHaveAttribute('max', String(max))
        await expect(sliderLocator).toHaveAttribute('step', String(step))
      })

      await test.step(`And its visible value reads "${shown}"`, async () => {
        await expect(await visibleValue(sliderLocator)).toHaveText(shown)
        await expect(sliderLocator).toHaveAttribute('aria-valuetext', spoken)
      })
    })
  }

  // @wip: Step 8.4
  test.fixme('Controls start at their defaults with units: the removed generation sliders', async ({
    page,
  }) => {
    const removedControls = [
      { control: 'Human generation (PRs/hr)', defaultValue: 1, shown: '1 PRs/hr' },
      { control: 'AI generation (PRs/hr)', defaultValue: 20, shown: '20 PRs/hr' },
      { control: 'PR size (LOC, both lanes)', defaultValue: 250, shown: '250 LOC' },
    ]
    await openSimulator(page)
    for (const { control, defaultValue, shown } of removedControls) {
      await expect(slider(page, control)).toHaveValue(String(defaultValue))
      await expect(await visibleValue(slider(page, control))).toHaveText(shown)
    }
  })

  // @wip: Step 8.4
  test.fixme('Sliders stop at their bounds: the removed AI generation slider', async ({ page }) => {
    const removedControl = 'AI generation (PRs/hr)'
    const sliderLocator = slider(page, removedControl)
    await openSimulator(page)
    await sliderLocator.focus()
    for (let press = 0; press < KEY_PRESSES; press += 1) await sliderLocator.press('ArrowRight')
    await expect(sliderLocator).toHaveValue('50')
  })

  // AC23: the derived values are plain read-only text, not sliders. The revised wording and the
  // changes under it belong to the scenario below, which Step 8.4 reworks.
  test('Derived PR sizes and AI PRs per day show at the defaults', async ({ page }) => {
    await openSimulator(page)

    await expect(laneLocator(page, 'human').getByText('PR size 240 LOC (derived)')).toBeVisible()
    const aiLane = laneLocator(page, 'ai')
    await expect(aiLane.getByText('PR size 362 LOC (1.51× human)')).toBeVisible()
    await expect(aiLane.getByText('1.17 PRs/day (derived)')).toBeVisible()
    await expect(aiLane.getByText('Effective speed 600 LOC/hr')).toBeVisible()
    await expect(aiLane.getByRole('slider')).toHaveCount(2)
  })

  // @wip: Step 8.4
  test.fixme('AI PR size and effective speed are derived and read-only', async ({ page }) => {
    const AI_GEN_LABEL = 'AI generation (PRs/hr)'
    const PR_SIZE_LABEL = 'PR size (LOC, both lanes)'
    const aiLane = laneLocator(page, 'ai')

    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('Then the AI lane shows "PR size 378 LOC" and "Effective speed 600 LOC/hr", each marked "derived"', async () => {
      const derivedSize = aiLane.locator('p', {
        hasText: `PR size ${REFERENCE.aiPrSizeAtDefaults} LOC`,
      })
      const derivedSpeed = aiLane.locator('p', { hasText: 'Effective speed 600 LOC/hr' })
      await expect(derivedSize).toContainText('derived')
      await expect(derivedSpeed).toContainText('derived')
    })

    await test.step('And neither derived value is a slider', async () => {
      await expect(aiLane.getByRole('slider')).toHaveCount(2)
      await expect(aiLane.getByRole('slider', { name: AI_GEN_LABEL })).toBeVisible()
      await expect(aiLane.getByRole('slider', { name: AI_SKIM_LABEL })).toBeVisible()
    })

    await test.step('When I set "PR size (LOC, both lanes)" to 200 and "AI skim multiplier" to 3', async () => {
      await setSlider(page, PR_SIZE_LABEL, 200)
      await setSlider(page, AI_SKIM_LABEL, 3)
    })

    await test.step('Then the AI lane shows "PR size 302 LOC" and "Effective speed 900 LOC/hr"', async () => {
      await expect(
        aiLane.locator('p', { hasText: `PR size ${REFERENCE.aiPrSizeAtPrSize200} LOC` }),
      ).toBeVisible()
      await expect(aiLane.locator('p', { hasText: 'Effective speed 900 LOC/hr' })).toBeVisible()
    })
  })

  for (const { control, key, bound } of BOUNDS) {
    test(`Sliders stop at their bounds: ${key} on ${control}`, async ({ page }) => {
      const sliderLocator = slider(page, control)

      await test.step('Given I open the simulator', async () => {
        await openSimulator(page)
      })

      await test.step(`When I press ${key} ${KEY_PRESSES} times on "${control}"`, async () => {
        await sliderLocator.focus()
        for (let press = 0; press < KEY_PRESSES; press += 1) await sliderLocator.press(key)
      })

      await test.step(`Then the "${control}" slider has value ${bound}`, async () => {
        await expect(sliderLocator).toHaveValue(String(bound))
      })
    })
  }

  // @wip: Step 8.4
  test.fixme('A review-side change applies on the next tick', async ({ page }) => {
    await test.step('Given the simulation has run for 1 second with defaults', async () => {
      await openSimulator(page)
      await startSimulation(page)
      await page.clock.runFor(1 * SECOND_MS)
    })

    await test.step('And the AI lane shows Deployed 1', async () => {
      await expect(metric(page, 'ai', 'deployed')).toHaveText(String(REFERENCE.aiDeployedAtTick10))
    })

    await test.step('When I set "Reviewer speed (LOC/hr, both lanes)" to 1000 and "AI skim multiplier" to 3', async () => {
      await setSlider(page, REVIEWER_SPEED_LABEL, 1000)
      await setSlider(page, AI_SKIM_LABEL, 3)
    })

    await test.step('And 0.1 seconds pass', async () => {
      await page.clock.runFor(TICK_MS)
    })

    await test.step('Then the AI lane shows Deployed 2', async () => {
      await expect(metric(page, 'ai', 'deployed')).toHaveText(
        String(REFERENCE.aiDeployedAtTick11WithFasterReview),
      )
    })

    await test.step('And the Start/Pause button still reads "Pause"', async () => {
      await expect(buttonNamed(page, 'Pause')).toBeVisible()
    })
  })

  // @wip: Step 8.4
  test.fixme('A change while paused takes effect only after Start', async ({ page }) => {
    const AI_GEN_LABEL = 'AI generation (PRs/hr)'

    await test.step('Given the simulation ran for 1 second and was paused', async () => {
      await openSimulator(page)
      await startSimulation(page)
      await page.clock.runFor(1 * SECOND_MS)
      await pauseSimulation(page)
    })

    await test.step('And the AI lane shows Pending Review 18', async () => {
      await expect(metric(page, 'ai', 'pending')).toHaveText(String(REFERENCE.aiPendingAtTick10))
    })

    await test.step('When I set "AI generation (PRs/hr)" to 50', async () => {
      await setSlider(page, AI_GEN_LABEL, 50)
    })

    await test.step('Then the AI lane still shows Pending Review 18', async () => {
      await expect(metric(page, 'ai', 'pending')).toHaveText(String(REFERENCE.aiPendingAtTick10))
    })

    await test.step('When I press Start and 0.1 seconds pass', async () => {
      await startSimulation(page)
      await page.clock.runFor(TICK_MS)
    })

    await test.step('Then the AI lane shows Pending Review 23', async () => {
      await expect(metric(page, 'ai', 'pending')).toHaveText(
        String(REFERENCE.aiPendingAtTick11WithAiGen50),
      )
    })
  })

  // @wip: Step 8.4
  test.fixme('A backlog drains to zero and never below', async ({ page }) => {
    const HUMAN_GEN_LABEL = 'Human generation (PRs/hr)'
    let sampledPending

    await test.step('Given I set "Human generation (PRs/hr)" to 10 and the simulation has run for 2 seconds', async () => {
      await openSimulator(page)
      await setSlider(page, HUMAN_GEN_LABEL, 10)
      await startSimulation(page)
      await page.clock.runFor(DRAIN_START_SECONDS * SECOND_MS)
    })

    await test.step('And the Human lane shows Pending Review 17', async () => {
      await expectCounts(page, 'human', {
        pending: REFERENCE.humanPendingAtTick20WithHumanGen10,
        deployed: REFERENCE.humanDeployedAtTick20WithHumanGen10,
      })
    })

    await test.step('When I set "Human generation (PRs/hr)" to 1 and "Reviewer speed (LOC/hr, both lanes)" to 1000', async () => {
      await setSlider(page, HUMAN_GEN_LABEL, 1)
      await setSlider(page, REVIEWER_SPEED_LABEL, 1000)
    })

    await test.step('And 6 seconds pass', async () => {
      sampledPending = await sampleEachTick(page, {
        startTick: DRAIN_START_SECONDS * TICKS_PER_SECOND,
        tickCount: (DRAIN_SECONDS * SECOND_MS) / TICK_MS,
        read: async () => (await metricValues(page, 'pending')).human,
      })
    })

    await test.step('Then the Human lane shows Pending Review 0', async () => {
      await expect(metric(page, 'human', 'pending')).toHaveText('0')
    })

    await test.step('And the Human Pending Review count, sampled every tick, was never below 0', async () => {
      expect(Math.min(...sampledPending)).toBeGreaterThanOrEqual(0)
    })
  })

  test('Sliders are keyboard operable', async ({ page }) => {
    const reviewerSpeedSlider = slider(page, REVIEWER_SPEED_LABEL)

    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I Tab to "Reviewer speed (LOC/hr, both lanes)" and press ArrowRight', async () => {
      await tabTo(page, reviewerSpeedSlider)
      await page.keyboard.press('ArrowRight')
    })

    await test.step('Then that slider has value 350 and its visible value reads "350 LOC/hr"', async () => {
      await expect(reviewerSpeedSlider).toHaveValue('350')
      await expect(await visibleValue(reviewerSpeedSlider)).toHaveText('350 LOC/hr')
    })
  })
})
