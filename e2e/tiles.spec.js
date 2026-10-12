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
  metric,
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
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

const AI_PENDING_22_AT_TICK = 12
const BUSY_HUMAN_GEN = 10
const HUGE_PR_SIZE = 1000
const SLOW_REVIEWER_SPEED = 100
const ONE_TICK = 1

// Human at gen 10, PR size 1000, speed 100 shows n - 1 pending PRs after n ticks (plan, Step 6.1).
// The capacity C is at most 98, so C is on screen by tick 99.
const MAX_TICKS = 99

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

    let tickNumber = 0
    let reachedCapacity = false
    while (!reachedCapacity && tickNumber < MAX_TICKS) {
      await page.clock.runFor(TICK_MS)
      tickNumber += 1
      await expectElapsedAtTick(page, tickNumber)
      const shownPending = Number(await metric(page, 'human', 'pending').textContent())
      reachedCapacity = shownPending === capacity
    }
    expect(reachedCapacity, `Human lane never showed ${capacity} within ${MAX_TICKS} ticks`).toBe(
      true,
    )

    await expectPending(page, 'human', capacity)
    await expect(tilesIn(page, 'human')).toHaveCount(capacity)
    await expect(overflowIn(page, 'human')).toHaveCount(0)

    await page.clock.runFor(TICK_MS)
    await expectElapsedAtTick(page, tickNumber + ONE_TICK)
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
