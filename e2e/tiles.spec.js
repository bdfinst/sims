import {
  AI_CODE_WRITTEN_LABEL,
  AI_SKIM_LABEL,
  BUSY_AI_PRESET,
  HUMAN_CODE_WRITTEN_LABEL,
  NEXT_TICK_SECONDS,
  OVERFLOW_RUN_SECONDS,
  REFERENCE,
  REVIEWER_SPEED_LABEL,
  TICKS_PER_SECOND,
  expect,
  expectEmptyLanes,
  expectSimulatorOpen,
  expectPending,
  overflowIn,
  queueBox,
  openAndReadCapacity,
  runFor,
  setSliders,
  startAndRunFor,
  test,
  tilesIn,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

const SECONDS_TO_AI_PENDING_22 = 5.7

// Exact: the AI lane gains exactly one pending PR per tick, so Pending Review is n after n ticks.
// Values from the plan's "Default arithmetic", independent of src.
const EXACT_AI_PRESET = Object.freeze({
  [HUMAN_CODE_WRITTEN_LABEL]: 5,
  [REVIEWER_SPEED_LABEL]: 100,
  [AI_SKIM_LABEL]: 1,
  [AI_CODE_WRITTEN_LABEL]: 704,
})

// Plan, "Default arithmetic": the exact AI preset displays AI Pending Review n after n ticks, for
// every n up to 100 (C is at most 98, so C + 1 is covered).
const exactAiPendingAfterTicks = (ticks) => ticks

test.describe('Pending Review tiles', () => {
  test('One tile per pending PR', async ({ page }) => {
    await test.step('Given the queue tile capacity C is read from the queue box', async () => {
      await openAndReadCapacity(page)
    })

    await test.step('Given I set "AI code written (LOC/hr)" to 2000', async () => {
      await setSliders(page, BUSY_AI_PRESET)
    })

    await test.step('When I press Start and 5.7 seconds pass', async () => {
      await startAndRunFor(page, SECONDS_TO_AI_PENDING_22)
    })

    await test.step('Then the AI lane shows Pending Review 22, 22 tiles, and no overflow indicator', async () => {
      await expectPending(page, 'ai', REFERENCE.busyAiPendingAtTick57)
      await expect(tilesIn(page, 'ai')).toHaveCount(REFERENCE.busyAiPendingAtTick57)
      await expect(overflowIn(page, 'ai')).toHaveCount(0)
    })
  })

  test('Empty queue shows no tiles', async ({ page }) => {
    await test.step('Given the queue tile capacity C is read from the queue box', async () => {
      await openAndReadCapacity(page)
    })

    await test.step('Given I open the simulator', async () => {
      await expectSimulatorOpen(page)
    })

    await test.step('Then neither Pending Review box shows any tiles', async () => {
      await expectEmptyLanes(page)
      await expect(queueBox(page, 'human')).toBeVisible()
      await expect(queueBox(page, 'ai')).toBeVisible()

      await expect(tilesIn(page, 'human')).toHaveCount(0)
      await expect(tilesIn(page, 'ai')).toHaveCount(0)
    })
  })

  test('Exactly at capacity has no overflow indicator', async ({ page }) => {
    let capacity

    await test.step('Given the queue tile capacity C is read from the queue box', async () => {
      capacity = await openAndReadCapacity(page)
    })

    await test.step('Given I set "Human code written (LOC/hr)" to 5, "Reviewer speed (LOC/hr, both lanes)" to 100, "AI skim multiplier" to 1, and "AI code written (LOC/hr)" to 704', async () => {
      await setSliders(page, EXACT_AI_PRESET)
    })

    await test.step('When I press Start and C ticks pass', async () => {
      // runFor waits for the elapsed readout to advance by exactly C ticks.
      await startAndRunFor(page, capacity / TICKS_PER_SECOND)
    })

    await test.step('Then the AI lane shows Pending Review C, C tiles, and no overflow indicator', async () => {
      await expectPending(page, 'ai', exactAiPendingAfterTicks(capacity))
      await expect(tilesIn(page, 'ai')).toHaveCount(capacity)
      await expect(overflowIn(page, 'ai')).toHaveCount(0)
    })

    await test.step('When 0.1 more seconds pass', async () => {
      await runFor(page, NEXT_TICK_SECONDS)
    })

    await test.step('Then the AI lane shows Pending Review C + 1, C tiles, and the text "+1 more"', async () => {
      await expectPending(page, 'ai', exactAiPendingAfterTicks(capacity + 1))
      await expect(tilesIn(page, 'ai')).toHaveCount(capacity)
      await expect(overflowIn(page, 'ai')).toHaveText('+1 more')
    })
  })

  test('Overflow beyond capacity', async ({ page }) => {
    let capacity

    await test.step('Given the queue tile capacity C is read from the queue box', async () => {
      capacity = await openAndReadCapacity(page)
    })

    await test.step('Given I set "AI code written (LOC/hr)" to 2000', async () => {
      await setSliders(page, BUSY_AI_PRESET)
    })

    await test.step('When I press Start and 30 seconds pass', async () => {
      await startAndRunFor(page, OVERFLOW_RUN_SECONDS)
    })

    await test.step('Then the AI lane shows C tiles and the text "+N more", where N is 115 minus C', async () => {
      await expectPending(page, 'ai', REFERENCE.busyAiPendingAtTick300)
      await expect(tilesIn(page, 'ai')).toHaveCount(capacity)
      await expect(overflowIn(page, 'ai')).toHaveText(
        `+${REFERENCE.busyAiPendingAtTick300 - capacity} more`,
      )
    })
  })
})
