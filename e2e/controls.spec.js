import {
  AI_CODE_WRITTEN_LABEL,
  AI_SKIM_LABEL,
  BUSY_AI_PRESET,
  HUMAN_CODE_WRITTEN_LABEL,
  HUMAN_PRS_PER_DAY_LABEL,
  REVIEWER_SPEED_LABEL,
  REFERENCE,
  THRESHOLD_LABEL,
  TICKS_PER_SECOND,
  expect,
  expectDeployed,
  expectPending,
  flushPendingRenders,
  laneLocator,
  metricValues,
  openSimulator,
  pauseSimulation,
  runFor,
  sampleEachTick,
  setSliders,
  slider,
  startAndRunFor,
  tabTo,
  test,
  buttonNamed,
  visibleValue,
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
  {
    control: THRESHOLD_LABEL,
    defaultValue: 15,
    min: 5,
    max: 50,
    step: 1,
    shown: '15 PRs',
    spoken: '15 PRs',
  },
]

const BOUNDS = [
  { control: HUMAN_CODE_WRITTEN_LABEL, key: 'ArrowRight', presses: 40, bound: 200 },
  { control: HUMAN_CODE_WRITTEN_LABEL, key: 'ArrowLeft', presses: 10, bound: 5 },
  { control: HUMAN_PRS_PER_DAY_LABEL, key: 'ArrowLeft', presses: 10, bound: 0.25 },
  { control: HUMAN_PRS_PER_DAY_LABEL, key: 'ArrowRight', presses: 20, bound: 4 },
  { control: REVIEWER_SPEED_LABEL, key: 'ArrowLeft', presses: 200, bound: 100 },
  { control: REVIEWER_SPEED_LABEL, key: 'ArrowRight', presses: 200, bound: 1000 },
  { control: AI_SKIM_LABEL, key: 'ArrowRight', presses: 200, bound: 3 },
  { control: AI_SKIM_LABEL, key: 'ArrowLeft', presses: 200, bound: 1 },
  { control: THRESHOLD_LABEL, key: 'ArrowLeft', presses: 50, bound: 5 },
  { control: THRESHOLD_LABEL, key: 'ArrowRight', presses: 50, bound: 50 },
]

const AI_CODE_WRITTEN_JUMPS = [
  { key: 'End', bound: 2000 },
  { key: 'Home', bound: 5 },
]

// Inputs the scenarios set (expected counts come from REFERENCE in fixtures.js).
const FAST_REVIEWER_SPEED = 1000
const MAX_SKIM = 3
const SLOW_REVIEWER_SPEED = 100
const DRAIN_AI_CODE_WRITTEN = 5
const DRAIN_RUN_SECONDS = 2
const BUSY_RUN_SECONDS = 1
const NEXT_TICK_SECONDS = 0.1

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

  test('Derived PR sizes, AI PRs per day, and effective speed are read-only', async ({ page }) => {
    const humanLane = laneLocator(page, 'human')
    const aiLane = laneLocator(page, 'ai')
    const derivedTexts = [
      [humanLane, 'PR size 240 LOC (derived)'],
      [aiLane, 'PR size 362 LOC (1.51× human)'],
      [aiLane, '1.17 PRs/day (derived)'],
      [aiLane, 'Effective speed 600 LOC/hr'],
    ]

    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('Then the Human lane shows "PR size 240 LOC (derived)"', async () => {
      await expect(humanLane.getByText('PR size 240 LOC (derived)')).toBeVisible()
    })

    await test.step('And the AI lane shows "PR size 362 LOC (1.51× human)", "1.17 PRs/day (derived)", and "Effective speed 600 LOC/hr"', async () => {
      await expect(aiLane.getByText('PR size 362 LOC (1.51× human)')).toBeVisible()
      await expect(aiLane.getByText('1.17 PRs/day (derived)')).toBeVisible()
      await expect(aiLane.getByText('Effective speed 600 LOC/hr')).toBeVisible()
    })

    await test.step('And none of the derived values is a slider', async () => {
      // The only sliders on the page are the six controls of "Controls start at their defaults".
      await expect(page.getByRole('slider')).toHaveCount(DEFAULT_CONTROLS.length)
      for (const [lane, text] of derivedTexts) {
        await expect(lane.getByText(text).getByRole('slider')).toHaveCount(0)
      }
    })

    await test.step('When I set "Human PRs per day" to 2 and "AI skim multiplier" to 3', async () => {
      await setSliders(page, { [HUMAN_PRS_PER_DAY_LABEL]: 2, [AI_SKIM_LABEL]: MAX_SKIM })
    })

    await test.step('Then the Human lane shows "PR size 120 LOC (derived)"', async () => {
      await expect(humanLane.getByText('PR size 120 LOC (derived)')).toBeVisible()
    })

    await test.step('And the AI lane shows "PR size 181 LOC (1.51× human)", "2.34 PRs/day (derived)", and "Effective speed 900 LOC/hr"', async () => {
      await expect(aiLane.getByText('PR size 181 LOC (1.51× human)')).toBeVisible()
      await expect(aiLane.getByText('2.34 PRs/day (derived)')).toBeVisible()
      await expect(aiLane.getByText('Effective speed 900 LOC/hr')).toBeVisible()
    })
  })

  for (const { control, key, presses, bound } of BOUNDS) {
    test(`Sliders stop at their bounds: ${key} on ${control}`, async ({ page }) => {
      const sliderLocator = slider(page, control)

      await test.step('Given I open the simulator', async () => {
        await openSimulator(page)
      })

      await test.step(`When I press ${key} ${presses} times on "${control}"`, async () => {
        await sliderLocator.focus()
        for (let press = 0; press < presses; press += 1) await sliderLocator.press(key)
      })

      await test.step(`Then the "${control}" slider has value ${bound}`, async () => {
        await expect(sliderLocator).toHaveValue(String(bound))
      })
    })
  }

  for (const { key, bound } of AI_CODE_WRITTEN_JUMPS) {
    test(`The AI code-written slider jumps to its bounds: ${key}`, async ({ page }) => {
      const sliderLocator = slider(page, AI_CODE_WRITTEN_LABEL)

      await test.step('Given I open the simulator', async () => {
        await openSimulator(page)
      })

      await test.step(`When I press ${key} on "AI code written (LOC/hr)"`, async () => {
        await sliderLocator.press(key)
      })

      await test.step(`Then the "AI code written (LOC/hr)" slider has value ${bound}`, async () => {
        await expect(sliderLocator).toHaveValue(String(bound))
      })
    })
  }

  test('A review-side change applies on the next tick', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 1 second', async () => {
      await openSimulator(page)
      await setSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, BUSY_RUN_SECONDS)
    })

    await test.step('And the AI lane shows Deployed 1', async () => {
      await expectDeployed(page, 'ai', REFERENCE.busyAiDeployedAtTick10)
    })

    await test.step('When I set "Reviewer speed (LOC/hr, both lanes)" to 1000 and "AI skim multiplier" to 3', async () => {
      await setSliders(page, {
        [REVIEWER_SPEED_LABEL]: FAST_REVIEWER_SPEED,
        [AI_SKIM_LABEL]: MAX_SKIM,
      })
    })

    await test.step('And 0.1 seconds pass', async () => {
      await runFor(page, NEXT_TICK_SECONDS)
    })

    await test.step('Then the AI lane shows Deployed 2', async () => {
      await expectDeployed(page, 'ai', REFERENCE.busyAiDeployedAtTick11WithFasterReview)
    })

    await test.step('And the Start/Pause button still reads "Pause"', async () => {
      await expect(buttonNamed(page, 'Pause')).toBeVisible()
    })
  })

  test('A change while paused takes effect only after Start', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation ran for 1 second and was paused', async () => {
      await openSimulator(page)
      await setSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, BUSY_RUN_SECONDS)
      await pauseSimulation(page)
    })

    await test.step('And the AI lane shows Pending Review 3', async () => {
      await expectPending(page, 'ai', REFERENCE.busyAiPendingAtTick10)
    })

    await test.step('When I set "Reviewer speed (LOC/hr, both lanes)" to 100', async () => {
      await setSliders(page, { [REVIEWER_SPEED_LABEL]: SLOW_REVIEWER_SPEED })
    })

    await test.step('Then the AI lane still shows Pending Review 3', async () => {
      await flushPendingRenders(page)
      await expectPending(page, 'ai', REFERENCE.busyAiPendingAtTick10)
    })

    await test.step('When I press Start and 0.1 seconds pass', async () => {
      await startAndRunFor(page, NEXT_TICK_SECONDS)
    })

    await test.step('Then the AI lane shows Pending Review 4', async () => {
      await expectPending(page, 'ai', REFERENCE.busyAiPendingAtTick11WithSlowReview)
    })
  })

  test('A backlog drains to zero and never below', async ({ page }) => {
    let sampledPending

    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 2 seconds', async () => {
      await openSimulator(page)
      await setSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, DRAIN_START_SECONDS)
    })

    await test.step('And the AI lane shows Pending Review 7', async () => {
      await expectPending(page, 'ai', REFERENCE.busyAiPendingAtTick20)
    })

    await test.step('When I set "AI code written (LOC/hr)" to 5 and "Reviewer speed (LOC/hr, both lanes)" to 1000', async () => {
      await setSliders(page, {
        [AI_CODE_WRITTEN_LABEL]: DRAIN_AI_CODE_WRITTEN,
        [REVIEWER_SPEED_LABEL]: FAST_REVIEWER_SPEED,
      })
    })

    await test.step('And 2 seconds pass', async () => {
      sampledPending = await sampleEachTick(page, {
        startTick: DRAIN_START_SECONDS * TICKS_PER_SECOND,
        tickCount: DRAIN_RUN_SECONDS * TICKS_PER_SECOND,
        read: async () => (await metricValues(page, 'pending')).ai,
      })
    })

    await test.step('Then the AI lane shows Pending Review 0', async () => {
      await expectPending(page, 'ai', 0)
    })

    await test.step('And the AI Pending Review count, sampled every tick, was never below 0', async () => {
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
