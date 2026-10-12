import {
  AI_SKIM_LABEL,
  PR_SIZE_LABEL,
  REVIEWER_SPEED_LABEL,
  expect,
  metric,
  openSimulator,
  setSlider,
  test,
} from './fixtures.js'

const SIZE_CASES = [
  { size: 50, caught: '80%' },
  { size: 200, caught: '80%' },
  { size: 300, caught: '42%' },
  { size: 400, caught: '4%' },
  { size: 1000, caught: '4%' },
]

const SPEED_CASES = [
  { speed: 500, caught: '80%' },
  { speed: 750, caught: '44%' },
  { speed: 900, caught: '22%' },
  { speed: 1000, caught: '8%' },
]

const SIZE_AT_DETECTION_KNEE = 200
const HUMAN_CAUGHT_AT_REST = '61%'
const AI_CAUGHT_AT_REST = '10%'
const AI_CAUGHT_AT_MAX_SKIM = '3%'
const AI_CAUGHT_AT_HUMAN_PACE = '12%'
const MAX_SKIM = 3
const HUMAN_PACE_SKIM = 1

const expectDefectsCaught = (page, laneId, shown) =>
  expect(metric(page, laneId, 'defectsCaught')).toHaveText(shown)

test.describe('Review quality metrics', () => {
  test('Defects caught and pending LOC at rest', async ({ page }) => {
    await openSimulator(page)

    await expectDefectsCaught(page, 'human', HUMAN_CAUGHT_AT_REST)
    await expect(metric(page, 'human', 'pendingLoc')).toHaveText('0')
    await expectDefectsCaught(page, 'ai', AI_CAUGHT_AT_REST)
    await expect(metric(page, 'ai', 'pendingLoc')).toHaveText('0')
  })

  for (const { size, caught } of SIZE_CASES) {
    test(`Defects caught follows PR size: ${size} LOC gives ${caught}`, async ({ page }) => {
      await openSimulator(page)

      await setSlider(page, PR_SIZE_LABEL, size)

      await expectDefectsCaught(page, 'human', caught)
    })
  }

  for (const { speed, caught } of SPEED_CASES) {
    test(`Defects caught follows reviewer speed: ${speed} LOC/hr gives ${caught}`, async ({
      page,
    }) => {
      await openSimulator(page)

      await setSlider(page, PR_SIZE_LABEL, SIZE_AT_DETECTION_KNEE)
      await setSlider(page, REVIEWER_SPEED_LABEL, speed)

      await expectDefectsCaught(page, 'human', caught)
    })
  }

  test('Skimming harder lowers AI defects caught', async ({ page }) => {
    await openSimulator(page)

    await setSlider(page, AI_SKIM_LABEL, MAX_SKIM)

    await expectDefectsCaught(page, 'ai', AI_CAUGHT_AT_MAX_SKIM)
  })

  test('Reviewing AI code at human pace restores some catching', async ({ page }) => {
    await openSimulator(page)

    await setSlider(page, AI_SKIM_LABEL, HUMAN_PACE_SKIM)

    await expectDefectsCaught(page, 'ai', AI_CAUGHT_AT_HUMAN_PACE)
  })
})
