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
    await openSimulator(page)

    await startAndRunFor(page, ticksToSeconds(AI_PENDING_22_AT_TICK))

    await expectPending(page, 'ai', REFERENCE.aiPendingAtTick12)
    await expect(tilesIn(page, 'ai')).toHaveCount(REFERENCE.aiPendingAtTick12)
    await expect(overflowIn(page, 'ai')).toHaveCount(0)
  })

  test('Empty queue shows no tiles', async ({ page }) => {
    await openSimulator(page)
    await expectEmptyLanes(page)
    await expect(queueBox(page, 'human')).toBeVisible()
    await expect(queueBox(page, 'ai')).toBeVisible()

    await expect(tilesIn(page, 'human')).toHaveCount(0)
    await expect(tilesIn(page, 'ai')).toHaveCount(0)
  })

  test('Exactly at capacity has no overflow indicator', async ({ page }) => {
    await openSimulator(page)
    const capacity = await readTileCapacity(page)
    await setSlider(page, HUMAN_GEN_LABEL, BUSY_HUMAN_GEN)
    await setSlider(page, PR_SIZE_LABEL, HUGE_PR_SIZE)
    await setSlider(page, REVIEWER_SPEED_LABEL, SLOW_REVIEWER_SPEED)
    await startSimulation(page)

    const ticksAtCapacity = ticksToFillQueue(capacity)
    await page.clock.runFor(ticksAtCapacity * TICK_MS)
    await expectElapsedAtTick(page, ticksAtCapacity)

    await expectPending(page, 'human', capacity)
    await expect(tilesIn(page, 'human')).toHaveCount(capacity)
    await expect(overflowIn(page, 'human')).toHaveCount(0)

    await page.clock.runFor(TICK_MS)
    await expectElapsedAtTick(page, ticksAtCapacity + ONE_TICK)
    await expectPending(page, 'human', capacity + 1)
    await expect(tilesIn(page, 'human')).toHaveCount(capacity)
    await expect(overflowIn(page, 'human')).toHaveText('+1 more')
  })

  test('Overflow beyond capacity', async ({ page }) => {
    await openSimulator(page)
    const capacity = await readTileCapacity(page)

    await startAndRunFor(page, FULL_RUN_SECONDS)

    await expectPending(page, 'ai', REFERENCE.aiPendingAtTick100)
    await expect(tilesIn(page, 'ai')).toHaveCount(capacity)
    await expect(overflowIn(page, 'ai')).toHaveText(
      `+${REFERENCE.aiPendingAtTick100 - capacity} more`,
    )
  })
})
