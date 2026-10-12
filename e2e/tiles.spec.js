import {
  HUMAN_GEN_LABEL,
  PR_SIZE_LABEL,
  REFERENCE,
  REVIEWER_SPEED_LABEL,
  TICK_MS,
  expect,
  expectElapsedAtTick,
  expectPending,
  metric,
  openSimulator,
  overflowIn,
  readTileCapacity,
  setSlider,
  startAndRunFor,
  startSimulation,
  test,
  tilesIn,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

const SECONDS_TO_AI_PENDING_22 = 1.2
const FULL_RUN_SECONDS = 10
const BUSY_HUMAN_GEN = 10
const HUGE_PR_SIZE = 1000
const SLOW_REVIEWER_SPEED = 100
const TENTH_SECOND_IN_TICKS = 1

// Human at gen 10, PR size 1000, speed 100 shows n - 1 pending PRs after n ticks (plan, Step 6.1).
const MAX_TICKS_TO_REACH_CAPACITY = 99

test.describe('Pending Review tiles', () => {
  test('One tile per pending PR', async ({ page }) => {
    await openSimulator(page)

    await startAndRunFor(page, SECONDS_TO_AI_PENDING_22)

    await expectPending(page, 'ai', REFERENCE.aiPendingAtTick12)
    await expect(tilesIn(page, 'ai')).toHaveCount(REFERENCE.aiPendingAtTick12)
    await expect(overflowIn(page, 'ai')).toHaveCount(0)
  })

  test('Empty queue shows no tiles', async ({ page }) => {
    await openSimulator(page)

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
    let shownPending = 0
    while (shownPending < capacity && tickNumber < MAX_TICKS_TO_REACH_CAPACITY) {
      await page.clock.runFor(TICK_MS)
      tickNumber += 1
      await expectElapsedAtTick(page, tickNumber)
      shownPending = Number(await metric(page, 'human', 'pending').textContent())
    }

    await expectPending(page, 'human', capacity)
    await expect(tilesIn(page, 'human')).toHaveCount(capacity)
    await expect(overflowIn(page, 'human')).toHaveCount(0)

    await page.clock.runFor(TICK_MS)
    await expectElapsedAtTick(page, tickNumber + TENTH_SECOND_IN_TICKS)
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
