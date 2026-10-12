import {
  AI_DRAIN_SETTINGS,
  BUSY_AI_PRESET,
  FULL_RUN_SECONDS,
  HUMAN_CODE_WRITTEN_LABEL,
  HUMAN_PRS_PER_DAY_LABEL,
  NEXT_TICK_SECONDS,
  QUEUE_STATE,
  REFERENCE,
  REVIEWER_SPEED_LABEL,
  THRESHOLD_LABEL,
  runFor,
  buttonNamed,
  expect,
  expectPending,
  expectQueueState,
  laneLocator,
  openWithSliders,
  openSimulator,
  pauseSimulation,
  queueBox,
  setSlider,
  setSliders,
  slider,
  startAndRunFor,
  test,
  visibleValue,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

// The spec's threshold oracle: kept as literals, independent of the app's slider table.
const DEFAULT_THRESHOLD = 15
const MIN_THRESHOLD = 5
const MAX_THRESHOLD = 50
const THRESHOLD_STEP = 1

// Thresholds the scenarios set, each relative to the displayed queues it is meant to straddle.
const THRESHOLD_AT_HUMAN_BACKLOG = 6 // Human 6 is not above it; AI 71 is
const THRESHOLD_AT_BUSY_AI_10_SECONDS = 38 // the busy AI queue at 10 s
const RAISED_THRESHOLD = 25 // above the busy AI queue at 6 s (23)
const KEPT_THRESHOLD = 30

const SECONDS_TO_AI_PENDING_14 = 3.8
const SECONDS_TO_AI_PENDING_15 = 3.9
const SECONDS_FROM_14_TO_16 = 0.4
const SECONDS_FROM_15_TO_16 = 0.3
const HUMAN_BACKLOG_SECONDS = 24
const SECONDS_TO_AI_PENDING_23 = 6
const SECONDS_TO_AI_PENDING_7 = 2
const SECONDS_TO_AI_PENDING_19 = 5
const SECONDS_TO_DRAIN_TO_16 = 0.6

// Human backlog: 400 LOC human PRs; the human queue gains one PR every 4 s (6 pending at 24 s).
// Values from the plan's "Default arithmetic", independent of src.
const HUMAN_BACKLOG_PRESET = Object.freeze({
  [HUMAN_CODE_WRITTEN_LABEL]: 200,
  [HUMAN_PRS_PER_DAY_LABEL]: 4,
  [REVIEWER_SPEED_LABEL]: 100,
})

// The red of the warning state: --color-warning (#ef4444) in src/index.css.
const WARNING_BORDER_COLOR = 'rgb(239, 68, 68)'
const QUEUE_LABEL_BY_LANE = { human: 'Human', ai: 'AI' }

// What a warning box looks like: the state, the alert icon, and the red border.
const expectWarningBox = async (page, laneId) => {
  const box = queueBox(page, laneId)
  await expect(box).toHaveAttribute('data-state', QUEUE_STATE.warning)
  await expect(box.locator('[data-icon="triangle-alert"]')).toBeVisible()
  await expect(box).toHaveCSS('border-color', WARNING_BORDER_COLOR)
}

// The lane's status element announces the warning.
const expectWarningAnnounced = (page, laneId) =>
  expect(laneLocator(page, laneId).getByRole('status')).toHaveText(
    `${QUEUE_LABEL_BY_LANE[laneId]} Pending Review over threshold`,
  )

// Waits for the slider's own shown value, so later checks cannot pass on the old threshold.
const setThreshold = async (page, value) => {
  await setSlider(page, THRESHOLD_LABEL, value)
  await expect(await visibleValue(slider(page, THRESHOLD_LABEL))).toHaveText(`${value} PRs`)
}

const expectLaneStates = async (page, statesByLane) => {
  for (const [laneId, state] of Object.entries(statesByLane)) {
    await expect(queueBox(page, laneId)).toHaveAttribute('data-state', state)
  }
}

test.describe('Pending Review overload warning', () => {
  test('AI queue turns red once it exceeds the default threshold', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
    })

    await test.step('When I press Start and 3.8 seconds pass', async () => {
      await startAndRunFor(page, SECONDS_TO_AI_PENDING_14)
    })

    await test.step('Then the AI lane shows Pending Review 14 and is not in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.busyAiPendingAtTick38, QUEUE_STATE.normal)
    })

    await test.step('When 0.4 more seconds pass', async () => {
      await runFor(page, SECONDS_FROM_14_TO_16)
    })

    await test.step('Then the AI lane shows Pending Review 16 and is in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.busyAiPendingAtTick42, QUEUE_STATE.warning)
    })

    await test.step('And the AI queue box shows a "triangle-alert" icon and a red border', async () => {
      await expectWarningBox(page, 'ai')
    })

    await test.step('And a status message announces "AI Pending Review over threshold"', async () => {
      await expectWarningAnnounced(page, 'ai')
    })

    await test.step('And the Human lane is not in the warning state', async () => {
      await expect(queueBox(page, 'human')).toHaveAttribute('data-state', QUEUE_STATE.normal)
      await expect(queueBox(page, 'human').locator('[data-icon]')).toHaveCount(0)
      await expect(laneLocator(page, 'human').getByRole('status')).toHaveText('')
    })
  })

  // Plan, "Look, accessibility, and test hooks": counts have no aria-live, and each lane's role="status" is its only announcer.
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
    await test.step('Given I set "AI code written (LOC/hr)" to 2000', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
    })

    await test.step('When I press Start and 3.9 seconds pass', async () => {
      await startAndRunFor(page, SECONDS_TO_AI_PENDING_15)
    })

    await test.step('Then the AI lane shows Pending Review 15 and is not in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.busyAiPendingAtTick39, QUEUE_STATE.normal)
    })

    await test.step('When 0.3 more seconds pass', async () => {
      await runFor(page, SECONDS_FROM_15_TO_16)
    })

    await test.step('Then the AI lane shows Pending Review 16 and is in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.busyAiPendingAtTick42, QUEUE_STATE.warning)
    })
  })

  test('A custom threshold applies to both lanes', async ({ page }) => {
    await test.step('Given I set "Human code written (LOC/hr)" to 200, "Human PRs per day" to 4, "Reviewer speed (LOC/hr, both lanes)" to 100, and "AI code written (LOC/hr)" to 2000, and the simulation ran for 24 seconds and was paused', async () => {
      await openWithSliders(page, { ...HUMAN_BACKLOG_PRESET, ...BUSY_AI_PRESET })
      await startAndRunFor(page, HUMAN_BACKLOG_SECONDS)
      await pauseSimulation(page)
    })

    await test.step('And the Human lane shows Pending Review 6 and the AI lane shows Pending Review 71', async () => {
      await expectPending(page, 'human', REFERENCE.humanBacklogHumanPendingAtTick240)
      await expectPending(page, 'ai', REFERENCE.humanBacklogAiPendingAtTick240)
    })

    await test.step('When I set "Warning threshold" to 6', async () => {
      await setThreshold(page, THRESHOLD_AT_HUMAN_BACKLOG)
    })

    await test.step('Then the Human lane is not in the warning state and the AI lane is in the warning state', async () => {
      await expectLaneStates(page, { human: QUEUE_STATE.normal, ai: QUEUE_STATE.warning })
    })

    await test.step('When I set "Warning threshold" to 5', async () => {
      await setThreshold(page, MIN_THRESHOLD)
    })

    await test.step('Then both lanes are in the warning state', async () => {
      await expectLaneStates(page, { human: QUEUE_STATE.warning, ai: QUEUE_STATE.warning })
    })
  })

  test('Exactly at a custom threshold is not a warning', async ({ page }) => {
    await test.step('Given I set "Warning threshold" to 38 and "AI code written (LOC/hr)" to 2000', async () => {
      await openSimulator(page)
      await setThreshold(page, THRESHOLD_AT_BUSY_AI_10_SECONDS)
      await setSliders(page, BUSY_AI_PRESET)
    })

    await test.step('When I press Start and 10 seconds pass', async () => {
      await startAndRunFor(page, FULL_RUN_SECONDS)
    })

    await test.step('Then the AI lane shows Pending Review 38 and is not in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.busyAiPendingAtTick100, QUEUE_STATE.normal)
    })
  })

  test('Raising the threshold while paused clears the warning', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation ran for 6 seconds and was paused', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, SECONDS_TO_AI_PENDING_23)
      await pauseSimulation(page)
    })

    await test.step('And the AI lane shows Pending Review 23 and is in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.busyAiPendingAtTick60, QUEUE_STATE.warning)
    })

    await test.step('When I set "Warning threshold" to 25', async () => {
      await setThreshold(page, RAISED_THRESHOLD)
    })

    await test.step('Then the AI lane is not in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.busyAiPendingAtTick60, QUEUE_STATE.normal)
    })
  })

  test('Lowering the threshold while running applies immediately', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 2 seconds', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, SECONDS_TO_AI_PENDING_7)
    })

    await test.step('And the AI lane shows Pending Review 7 and is not in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.busyAiPendingAtTick20, QUEUE_STATE.normal)
    })

    await test.step('When I set "Warning threshold" to 5', async () => {
      await setThreshold(page, MIN_THRESHOLD)
    })

    await test.step('Then the AI lane is in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.busyAiPendingAtTick20, QUEUE_STATE.warning)
      // Not in a step's text: the title's "while running" holds, as the simulation never paused.
      await expect(buttonNamed(page, 'Pause')).toBeVisible()
    })
  })

  test('Warning clears when the queue drains to the threshold', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 5 seconds', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, SECONDS_TO_AI_PENDING_19)
    })

    await test.step('And the AI lane shows Pending Review 19 and is in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.busyAiPendingAtTick50, QUEUE_STATE.warning)
    })

    await test.step('When I set "AI code written (LOC/hr)" to 5 and "Reviewer speed (LOC/hr, both lanes)" to 1000', async () => {
      await setSliders(page, AI_DRAIN_SETTINGS)
    })

    await test.step('And 0.6 seconds pass', async () => {
      await runFor(page, SECONDS_TO_DRAIN_TO_16)
    })

    await test.step('Then the AI lane shows Pending Review 16 and is in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.drainedAiPendingAtTick56, QUEUE_STATE.warning)
    })

    await test.step('When 0.1 more seconds pass', async () => {
      await runFor(page, NEXT_TICK_SECONDS)
    })

    await test.step('Then the AI lane shows Pending Review 15 and is not in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.drainedAiPendingAtTick57, QUEUE_STATE.normal)
    })
  })

  test('Threshold slider default and bounds', async ({ page }) => {
    const threshold = slider(page, THRESHOLD_LABEL)

    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('Then "Warning threshold" has value 15, min 5, max 50, and step 1', async () => {
      await expect(threshold).toHaveValue(String(DEFAULT_THRESHOLD))
      await expect(threshold).toHaveAttribute('min', String(MIN_THRESHOLD))
      await expect(threshold).toHaveAttribute('max', String(MAX_THRESHOLD))
      await expect(threshold).toHaveAttribute('step', String(THRESHOLD_STEP))
    })
  })

  test('Reset keeps the threshold', async ({ page }) => {
    await test.step('Given I set "Warning threshold" to 30', async () => {
      await openSimulator(page)
      await setThreshold(page, KEPT_THRESHOLD)
    })

    await test.step('When I press Reset', async () => {
      await buttonNamed(page, 'Reset').click()
    })

    await test.step('Then "Warning threshold" has value 30', async () => {
      await expect(slider(page, THRESHOLD_LABEL)).toHaveValue(String(KEPT_THRESHOLD))
    })
  })
})
