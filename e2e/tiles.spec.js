import {
  HUMAN_GEN_LABEL,
  FULL_RUN_SECONDS,
  PR_SIZE_LABEL,
  REFERENCE,
  REVIEWER_SPEED_LABEL,
  TICK_MS,
  expect,
  expectElapsedAtTick,
  expectEmptyLanes,
  expectSimulatorOpen,
  expectPending,
  openSimulator,
  overflowIn,
  queueBox,
  readTileCapacity,
  setSlider,
  startAndRunFor,
  startSimulation,
  test,
  tilesIn,
  ticksToSeconds,
  AI_PENDING_22_AT_TICK,
  BUSY_HUMAN_GEN,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

const HUGE_PR_SIZE = 1000
const SLOW_REVIEWER_SPEED = 100
const ONE_TICK = 1

// Human at gen 10, PR size 1000, speed 100 shows n - 1 pending PRs after n ticks (plan, Step 6.1),
// so the queue holds exactly C PRs after C + 1 ticks.
const ticksToFillQueue = (capacity) => capacity + 1

test.describe('Pending Review tiles', () => {
  test('One tile per pending PR', async ({ page }) => {
    await test.step('Given the queue tile capacity C is read from the queue box', async () => {
      await openSimulator(page)
      await readTileCapacity(page)
    })

    await test.step('Given I open the simulator', async () => {
      await expectSimulatorOpen(page)
    })

    await test.step('When I press Start and 1.2 seconds pass', async () => {
      await startAndRunFor(page, ticksToSeconds(AI_PENDING_22_AT_TICK))
    })

    await test.step('Then the AI lane shows Pending Review 22, 22 tiles, and no overflow indicator', async () => {
      await expectPending(page, 'ai', REFERENCE.aiPendingAtTick12)
      await expect(tilesIn(page, 'ai')).toHaveCount(REFERENCE.aiPendingAtTick12)
      await expect(overflowIn(page, 'ai')).toHaveCount(0)
    })
  })

  test('Empty queue shows no tiles', async ({ page }) => {
    await test.step('Given the queue tile capacity C is read from the queue box', async () => {
      await openSimulator(page)
      await readTileCapacity(page)
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
    let ticksAtCapacity

    await test.step('Given the queue tile capacity C is read from the queue box', async () => {
      await openSimulator(page)
      capacity = await readTileCapacity(page)
      ticksAtCapacity = ticksToFillQueue(capacity)
    })

    await test.step('Given I set "Human generation (PRs/hr)" to 10, "PR size (LOC, both lanes)" to 1000, and "Reviewer speed (LOC/hr, both lanes)" to 100', async () => {
      await setSlider(page, HUMAN_GEN_LABEL, BUSY_HUMAN_GEN)
      await setSlider(page, PR_SIZE_LABEL, HUGE_PR_SIZE)
      await setSlider(page, REVIEWER_SPEED_LABEL, SLOW_REVIEWER_SPEED)
    })

    await test.step('When I press Start and C + 1 ticks pass', async () => {
      await startSimulation(page)
      await page.clock.runFor(ticksAtCapacity * TICK_MS)
      await expectElapsedAtTick(page, ticksAtCapacity)
    })

    await test.step('Then the Human lane shows Pending Review C, C tiles, and no overflow indicator', async () => {
      await expectPending(page, 'human', capacity)
      await expect(tilesIn(page, 'human')).toHaveCount(capacity)
      await expect(overflowIn(page, 'human')).toHaveCount(0)
    })

    await test.step('When 0.1 more seconds pass', async () => {
      await page.clock.runFor(TICK_MS)
      await expectElapsedAtTick(page, ticksAtCapacity + ONE_TICK)
    })

    await test.step('Then the Human lane shows Pending Review C + 1, C tiles, and the text "+1 more"', async () => {
      await expectPending(page, 'human', capacity + 1)
      await expect(tilesIn(page, 'human')).toHaveCount(capacity)
      await expect(overflowIn(page, 'human')).toHaveText('+1 more')
    })
  })

  test('Overflow beyond capacity', async ({ page }) => {
    let capacity

    await test.step('Given the queue tile capacity C is read from the queue box', async () => {
      await openSimulator(page)
      capacity = await readTileCapacity(page)
    })

    await test.step('Given I open the simulator', async () => {
      await expectSimulatorOpen(page)
    })

    await test.step('When I press Start and 10 seconds pass', async () => {
      await startAndRunFor(page, FULL_RUN_SECONDS)
    })

    await test.step('Then the AI lane shows C tiles and the text "+N more", where N is 184 minus C', async () => {
      await expectPending(page, 'ai', REFERENCE.aiPendingAtTick100)
      await expect(tilesIn(page, 'ai')).toHaveCount(capacity)
      await expect(overflowIn(page, 'ai')).toHaveText(
        `+${REFERENCE.aiPendingAtTick100 - capacity} more`,
      )
    })
  })
})
