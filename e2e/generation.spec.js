import {
  AI_CODE_WRITTEN_LABEL,
  BUSY_AI_PRESET,
  HUMAN_CODE_WRITTEN_LABEL,
  HUMAN_PRS_PER_DAY_LABEL,
  QUARTER_PR_PER_DAY,
  QUEUE_STATE,
  REFERENCE,
  TICKS_PER_SECOND,
  expect,
  expectCounts,
  expectDefectsCaught,
  expectQueueState,
  expectStrictlyIncreasing,
  laneLocator,
  metricValues,
  openWithSliders,
  openSimulator,
  sampleEachTick,
  setSliders,
  startAndRunFor,
  startSimulation,
  test,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

// Inputs the scenarios set (expected values come from REFERENCE and the plan's "Derived display").
const HALF_PR_PER_DAY = 0.5
const ROUNDING_CODE_WRITTEN = 35
const ROUNDING_PRS_PER_DAY = 0.75
const OVER_CAPACITY_AI_CODE_WRITTEN = 1000
const AT_CAPACITY_AI_CODE_WRITTEN = 600
const OVER_CAPACITY_RUN_SECONDS = 15
const AT_CAPACITY_RUN_SECONDS = 10

// Each text is the whole text of an element visible in the lane.
const expectLaneShows = async (page, laneId, texts) => {
  for (const text of texts) {
    await expect(laneLocator(page, laneId).getByText(text, { exact: true })).toBeVisible()
  }
}

test.describe('Generate code and derive PR size', () => {
  test('AI PR size follows the human PR size', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I set "Human PRs per day" to 0.5', async () => {
      await setSliders(page, { [HUMAN_PRS_PER_DAY_LABEL]: HALF_PR_PER_DAY })
    })

    await test.step('Then the Human lane shows "PR size 480 LOC (derived)"', async () => {
      await expectLaneShows(page, 'human', ['PR size 480 LOC (derived)'])
    })

    await test.step('And the AI lane shows "PR size 725 LOC (1.51× human)" and "0.58 PRs/day (derived)"', async () => {
      await expectLaneShows(page, 'ai', ['PR size 725 LOC (1.51× human)', '0.58 PRs/day (derived)'])
    })
  })

  test('AI code written changes only the AI PR frequency', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I set "AI code written (LOC/hr)" to 2000', async () => {
      await setSliders(page, BUSY_AI_PRESET)
    })

    await test.step('Then the AI lane shows "PR size 362 LOC (1.51× human)" and "44.15 PRs/day (derived)"', async () => {
      await expectLaneShows(page, 'ai', [
        'PR size 362 LOC (1.51× human)',
        '44.15 PRs/day (derived)',
      ])
    })

    await test.step('And the Human lane still shows "PR size 240 LOC (derived)"', async () => {
      await expectLaneShows(page, 'human', ['PR size 240 LOC (derived)'])
    })
  })

  test('A human PR can span several days', async ({ page }) => {
    await test.step('Given I set "Human PRs per day" to 0.25', async () => {
      await openWithSliders(page, { [HUMAN_PRS_PER_DAY_LABEL]: QUARTER_PR_PER_DAY })
    })

    await test.step('Then the Human lane shows "PR size 960 LOC (derived)" and Defects caught 4%', async () => {
      await expectLaneShows(page, 'human', ['PR size 960 LOC (derived)'])
      // Defects caught depends only on PR size (960 LOC) and speed, so the mid-run figure applies.
      await expectDefectsCaught(page, 'human', REFERENCE.humanDefectsCaughtAfterPrsPerDay025)
    })

    await test.step('And the AI lane shows "PR size 1,450 LOC (1.51× human)" and "0.29 PRs/day (derived)"', async () => {
      await expectLaneShows(page, 'ai', [
        'PR size 1,450 LOC (1.51× human)',
        '0.29 PRs/day (derived)',
      ])
    })
  })

  test('Derived values round to whole LOC and two decimals', async ({ page }) => {
    await test.step('Given I set "Human code written (LOC/hr)" to 35 and "Human PRs per day" to 0.75', async () => {
      await openWithSliders(page, {
        [HUMAN_CODE_WRITTEN_LABEL]: ROUNDING_CODE_WRITTEN,
        [HUMAN_PRS_PER_DAY_LABEL]: ROUNDING_PRS_PER_DAY,
      })
    })

    await test.step('Then the Human lane shows "PR size 373 LOC (derived)"', async () => {
      await expectLaneShows(page, 'human', ['PR size 373 LOC (derived)'])
    })

    await test.step('And the AI lane shows "PR size 564 LOC (1.51× human)" and "0.75 PRs/day (derived)"', async () => {
      await expectLaneShows(page, 'ai', ['PR size 564 LOC (1.51× human)', '0.75 PRs/day (derived)'])
    })
  })

  test('Raising AI code written past review capacity grows the AI queue', async ({ page }) => {
    const readAiPendingLoc = async () => (await metricValues(page, 'pendingLoc')).ai
    let sampledPendingLoc

    await test.step('Given I set "AI code written (LOC/hr)" to 1000', async () => {
      await openWithSliders(page, { [AI_CODE_WRITTEN_LABEL]: OVER_CAPACITY_AI_CODE_WRITTEN })
    })

    await test.step('When I press Start and 15 seconds pass', async () => {
      const beforeStart = await readAiPendingLoc()
      await startSimulation(page)
      const eachTick = await sampleEachTick(page, {
        startTick: 0,
        tickCount: OVER_CAPACITY_RUN_SECONDS * TICKS_PER_SECOND,
        read: readAiPendingLoc,
      })
      sampledPendingLoc = [beforeStart, ...eachTick]
    })

    await test.step('Then the AI lane shows Pending Review 16 and is in the warning state', async () => {
      await expectQueueState(
        page,
        'ai',
        REFERENCE.aiCodeWritten1000PendingAtTick150,
        QUEUE_STATE.warning,
      )
    })

    await test.step('And the AI Pending LOC, sampled every tick, strictly increased', async () => {
      expect(sampledPendingLoc).toHaveLength(OVER_CAPACITY_RUN_SECONDS * TICKS_PER_SECOND + 1)
      expectStrictlyIncreasing(sampledPendingLoc, 'AI Pending LOC each tick')
    })
  })

  test('AI code written at review capacity keeps the queue empty', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 600', async () => {
      await openWithSliders(page, { [AI_CODE_WRITTEN_LABEL]: AT_CAPACITY_AI_CODE_WRITTEN })
    })

    await test.step('When I press Start and 10 seconds pass', async () => {
      await startAndRunFor(page, AT_CAPACITY_RUN_SECONDS)
    })

    await test.step('Then the AI lane shows Pending Review 0 and Deployed 16', async () => {
      await expectCounts(page, 'ai', {
        pending: REFERENCE.aiCodeWritten600PendingAtTick100,
        deployed: REFERENCE.aiCodeWritten600DeployedAtTick100,
      })
    })
  })
})
