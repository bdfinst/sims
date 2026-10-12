import {
  HUMAN_GEN_LABEL,
  QUEUE_STATE,
  REFERENCE,
  REVIEWER_SPEED_LABEL,
  THRESHOLD_LABEL,
  advanceSeconds,
  buttonNamed,
  expect,
  expectPending,
  expectQueueState,
  expectWarningAnnounced,
  expectWarningBox,
  laneLocator,
  openSimulator,
  pauseSimulation,
  queueBox,
  setSlider,
  slider,
  startAndRunFor,
  startSimulation,
  test,
  ticksToSeconds,
  visibleValue,
  BUSY_HUMAN_GEN,
  QUIET_HUMAN_GEN,
  FAST_REVIEWER_SPEED,
  AI_PENDING_22_AT_TICK,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

// The spec's threshold oracle: kept as literals, independent of the app's slider table.
const DEFAULT_THRESHOLD = 15
const MIN_THRESHOLD = 5
const MAX_THRESHOLD = 50
const THRESHOLD_STEP = 1

// Thresholds derived from the displayed queues they are meant to straddle.
const HUMAN_PENDING = REFERENCE.humanPendingAtTick20WithHumanGen10 // 17, with the AI lane at 36
const THRESHOLD_BETWEEN_LANES = HUMAN_PENDING
const THRESHOLD_BELOW_BOTH_LANES = HUMAN_PENDING - 1
const THRESHOLD_AT_AI_PENDING = REFERENCE.aiPendingAtTick10
const RAISED_THRESHOLD = REFERENCE.aiPendingAtTick12 + 3
const KEPT_THRESHOLD = 30

const SECONDS_TO_AI_PENDING_14 = 0.8
const SECONDS_TO_AI_PENDING_16 = 0.9
const SECONDS_TO_AI_PENDING_9 = 0.5
const SECONDS_TO_HUMAN_PENDING_15 = 1.8
const SECONDS_TO_HUMAN_PENDING_16 = 1.9
const SECONDS_TO_BUILD_BACKLOG = 2
const SECONDS_TO_AI_PENDING_18 = 1
const HALF_SECOND = 0.5
const TENTH_SECOND = 0.1

const openWithBusyHuman = async (page) => {
  await openSimulator(page)
  await setSlider(page, HUMAN_GEN_LABEL, BUSY_HUMAN_GEN)
}

// Waits for the slider's own shown value, so later checks cannot pass on the old threshold.
const setThreshold = async (page, value) => {
  await setSlider(page, THRESHOLD_LABEL, value)
  await expect(await visibleValue(slider(page, THRESHOLD_LABEL))).toHaveText(`${value} PRs`)
}

test.describe('Pending Review overload warning', () => {
  test('AI queue turns red once it exceeds the default threshold', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I press Start and 0.8 seconds pass', async () => {
      await startSimulation(page)
      await advanceSeconds(page, SECONDS_TO_AI_PENDING_14, SECONDS_TO_AI_PENDING_14)
    })

    await test.step('Then the AI lane shows Pending Review 14 and is not in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.aiPendingAtTick8, QUEUE_STATE.normal)
    })

    await test.step('When 0.1 more seconds pass', async () => {
      await advanceSeconds(page, TENTH_SECOND, SECONDS_TO_AI_PENDING_16)
    })

    await test.step('Then the AI lane shows Pending Review 16 and is in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.aiPendingAtTick9, QUEUE_STATE.warning)
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
    await test.step('Given I set "Human generation (PRs/hr)" to 10', async () => {
      await openWithBusyHuman(page)
    })

    await test.step('When I press Start and 1.8 seconds pass', async () => {
      await startSimulation(page)
      await advanceSeconds(page, SECONDS_TO_HUMAN_PENDING_15, SECONDS_TO_HUMAN_PENDING_15)
    })

    await test.step('Then the Human lane shows Pending Review 15 and is not in the warning state', async () => {
      await expectQueueState(
        page,
        'human',
        REFERENCE.humanPendingAtTick18WithHumanGen10,
        QUEUE_STATE.normal,
      )
    })

    await test.step('When 0.1 more seconds pass', async () => {
      await advanceSeconds(page, TENTH_SECOND, SECONDS_TO_HUMAN_PENDING_16)
    })

    await test.step('Then the Human lane shows Pending Review 16 and is in the warning state', async () => {
      await expectQueueState(
        page,
        'human',
        REFERENCE.humanPendingAtTick19WithHumanGen10,
        QUEUE_STATE.warning,
      )
    })
  })

  test('A custom threshold applies to both lanes', async ({ page }) => {
    await test.step('Given I set "Human generation (PRs/hr)" to 10 and the simulation ran for 2 seconds and was paused', async () => {
      await openWithBusyHuman(page)
      await startAndRunFor(page, SECONDS_TO_BUILD_BACKLOG)
      await pauseSimulation(page)
    })

    await test.step('And the Human lane shows Pending Review 17 and the AI lane shows Pending Review 36', async () => {
      await expectPending(page, 'human', REFERENCE.humanPendingAtTick20WithHumanGen10)
      await expectPending(page, 'ai', REFERENCE.aiPendingAtTick20WithHumanGen10)
    })

    await test.step('When I set "Warning threshold" to 17', async () => {
      await setThreshold(page, THRESHOLD_BETWEEN_LANES)
    })

    await test.step('Then the Human lane is not in the warning state and the AI lane is in the warning state', async () => {
      await expect(queueBox(page, 'human')).toHaveAttribute('data-state', QUEUE_STATE.normal)
      await expect(queueBox(page, 'ai')).toHaveAttribute('data-state', QUEUE_STATE.warning)
    })

    await test.step('When I set "Warning threshold" to 16', async () => {
      await setThreshold(page, THRESHOLD_BELOW_BOTH_LANES)
    })

    await test.step('Then both lanes are in the warning state', async () => {
      await expect(queueBox(page, 'human')).toHaveAttribute('data-state', QUEUE_STATE.warning)
      await expect(queueBox(page, 'ai')).toHaveAttribute('data-state', QUEUE_STATE.warning)
    })
  })

  test('Exactly at a custom threshold is not a warning', async ({ page }) => {
    await test.step('Given I set "Warning threshold" to 18', async () => {
      await openSimulator(page)
      await setThreshold(page, THRESHOLD_AT_AI_PENDING)
    })

    await test.step('When I press Start and 1 second passes', async () => {
      await startAndRunFor(page, SECONDS_TO_AI_PENDING_18)
    })

    await test.step('Then the AI lane shows Pending Review 18 and is not in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.aiPendingAtTick10, QUEUE_STATE.normal)
    })
  })

  test('Raising the threshold while paused clears the warning', async ({ page }) => {
    await test.step('Given the simulation ran for 1.2 seconds and was paused', async () => {
      await openSimulator(page)
      await startAndRunFor(page, ticksToSeconds(AI_PENDING_22_AT_TICK))
      await pauseSimulation(page)
    })

    await test.step('And the AI lane shows Pending Review 22 and is in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.aiPendingAtTick12, QUEUE_STATE.warning)
    })

    await test.step('When I set "Warning threshold" to 25', async () => {
      await setThreshold(page, RAISED_THRESHOLD)
    })

    await test.step('Then the AI lane is not in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.aiPendingAtTick12, QUEUE_STATE.normal)
    })
  })

  test('Lowering the threshold while running applies immediately', async ({ page }) => {
    await test.step('Given the simulation has run for 0.5 seconds', async () => {
      await openSimulator(page)
      await startAndRunFor(page, SECONDS_TO_AI_PENDING_9)
    })

    await test.step('And the AI lane shows Pending Review 9 and is not in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.aiPendingAtTick5, QUEUE_STATE.normal)
    })

    await test.step('When I set "Warning threshold" to 5', async () => {
      await setThreshold(page, MIN_THRESHOLD)
    })

    await test.step('Then the AI lane is in the warning state', async () => {
      await expectQueueState(page, 'ai', REFERENCE.aiPendingAtTick5, QUEUE_STATE.warning)
      await expect(buttonNamed(page, 'Pause')).toBeVisible()
    })
  })

  test('Warning clears when the queue drains to the threshold', async ({ page }) => {
    await test.step('Given I set "Human generation (PRs/hr)" to 10 and the simulation has run for 2 seconds', async () => {
      await openWithBusyHuman(page)
      await startAndRunFor(page, SECONDS_TO_BUILD_BACKLOG)
    })

    await test.step('And the Human lane shows Pending Review 17 and is in the warning state', async () => {
      await expectQueueState(
        page,
        'human',
        REFERENCE.humanPendingAtTick20WithHumanGen10,
        QUEUE_STATE.warning,
      )
    })

    await test.step('When I set "Human generation (PRs/hr)" to 1 and "Reviewer speed (LOC/hr, both lanes)" to 1000', async () => {
      await setSlider(page, HUMAN_GEN_LABEL, QUIET_HUMAN_GEN)
      await setSlider(page, REVIEWER_SPEED_LABEL, FAST_REVIEWER_SPEED)
    })

    await test.step('And 0.5 seconds pass', async () => {
      await advanceSeconds(page, HALF_SECOND, SECONDS_TO_BUILD_BACKLOG + HALF_SECOND)
    })

    await test.step('Then the Human lane shows Pending Review 16 and is in the warning state', async () => {
      await expectQueueState(
        page,
        'human',
        REFERENCE.humanPendingAtTick25AfterDraining,
        QUEUE_STATE.warning,
      )
    })

    await test.step('When 0.1 more seconds pass', async () => {
      await advanceSeconds(
        page,
        TENTH_SECOND,
        SECONDS_TO_BUILD_BACKLOG + HALF_SECOND + TENTH_SECOND,
      )
    })

    await test.step('Then the Human lane shows Pending Review 15 and is not in the warning state', async () => {
      await expectQueueState(
        page,
        'human',
        REFERENCE.humanPendingAtTick26AfterDraining,
        QUEUE_STATE.normal,
      )
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
