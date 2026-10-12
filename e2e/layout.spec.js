import {
  AI_GEN_LABEL,
  AI_SKIM_LABEL,
  HUMAN_GEN_LABEL,
  PR_SIZE_LABEL,
  REVIEWER_SPEED_LABEL,
  THRESHOLD_LABEL,
  buttonNamed,
  expect,
  headline,
  laneLocator,
  metric,
  openSimulator,
  overflowIn,
  queueBox,
  slider,
  startAndRunFor,
  tabTo,
  test,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

const PROJECTOR = { width: 1280, height: 720 }
const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 375, height: 667 }
const FULL_RUN_SECONDS = 10
const PAGE_BACKGROUND = 'rgb(11, 13, 18)'
const METRIC_ROWS_TOP_TO_BOTTOM = [
  'deployed',
  'defectsCaught',
  'incidents',
  'incidentsPerPr',
  'pickupWait',
]
const HUMAN_CONTROLS = {
  generation: HUMAN_GEN_LABEL,
  review: REVIEWER_SPEED_LABEL,
}
const AI_CONTROLS = { generation: AI_GEN_LABEL, review: AI_SKIM_LABEL }
const CONTROLS_BY_LANE = { human: HUMAN_CONTROLS, ai: AI_CONTROLS }

const boxOf = async (locator) => {
  const box = await locator.boundingBox()
  expect(box, 'element has a layout box').not.toBeNull()
  return box
}

const metricsGrid = (page, laneId) =>
  laneLocator(page, laneId).locator('dl', { has: page.locator('[data-metric="incidents"]') })

const expectInsideViewport = async (locator, viewport) => {
  const { x, y, width, height } = await boxOf(locator)
  expect(y).toBeGreaterThanOrEqual(0)
  expect(y + height).toBeLessThanOrEqual(viewport.height)
  expect(x).toBeGreaterThanOrEqual(0)
  expect(x + width).toBeLessThanOrEqual(viewport.width)
}

// The positions of a lane's three groups: inputs, Pending Review box, review side.
const laneGroups = async (page, laneId) => {
  const controls = CONTROLS_BY_LANE[laneId]
  return {
    inputs: await boxOf(slider(page, controls.generation)),
    queue: await boxOf(queueBox(page, laneId)),
    review: await boxOf(slider(page, controls.review)),
    metrics: await boxOf(metricsGrid(page, laneId)),
  }
}

test.describe('Pending Review layout', () => {
  test.describe('on a projector (1280 x 720)', () => {
    test.use({ viewport: PROJECTOR })

    test('Projector fit: header, headline, counts and metric grids are all on screen', async ({
      page,
    }) => {
      await openSimulator(page)
      await startAndRunFor(page, FULL_RUN_SECONDS)

      await expectInsideViewport(page.getByRole('banner'), PROJECTOR)
      await expectInsideViewport(headline(page), PROJECTOR)
      for (const laneId of ['human', 'ai']) {
        await expectInsideViewport(metric(page, laneId, 'pending'), PROJECTOR)
        await expectInsideViewport(metricsGrid(page, laneId), PROJECTOR)
        await expectInsideViewport(laneLocator(page, laneId), PROJECTOR)
      }
    })
  })

  test.describe('on a desktop (1280 x 800)', () => {
    test.use({ viewport: DESKTOP })

    test('Metric rows line up across lanes', async ({ page }) => {
      await openSimulator(page)

      for (const row of METRIC_ROWS_TOP_TO_BOTTOM) {
        const human = await boxOf(metric(page, 'human', row))
        const ai = await boxOf(metric(page, 'ai', row))
        expect(ai.x, `${row} left edge`).toBe(human.x)
      }
    })

    test('Metric rows keep one fixed order in both lanes', async ({ page }) => {
      await openSimulator(page)

      for (const laneId of ['human', 'ai']) {
        const tops = []
        for (const row of METRIC_ROWS_TOP_TO_BOTTOM) {
          tops.push((await boxOf(metric(page, laneId, row))).y)
        }
        expect(tops).toEqual([...tops].sort((a, b) => a - b))
      }
    })

    test('Wide layout reads left to right', async ({ page }) => {
      await openSimulator(page)

      for (const laneId of ['human', 'ai']) {
        const { inputs, queue, review } = await laneGroups(page, laneId)
        expect(inputs.x + inputs.width, `${laneId} inputs end`).toBeLessThanOrEqual(queue.x)
        expect(queue.x + queue.width, `${laneId} queue ends`).toBeLessThanOrEqual(review.x)
      }
      const title = await boxOf(page.getByRole('heading', { level: 1 }))
      const start = await boxOf(buttonNamed(page, 'Start'))
      const reset = await boxOf(buttonNamed(page, 'Reset'))
      expect(start.x).toBeGreaterThanOrEqual(title.x + title.width)
      expect(reset.x).toBeGreaterThanOrEqual(title.x + title.width)
    })

    test('Dark theme', async ({ page }) => {
      await openSimulator(page)

      await expect(page.locator('body')).toHaveCSS('background-color', PAGE_BACKGROUND)
    })
  })

  test.describe('on a phone (375 x 667)', () => {
    test.use({ viewport: PHONE })

    test('No horizontal scroll on a phone, even when overflowing', async ({ page }) => {
      await openSimulator(page)
      await startAndRunFor(page, FULL_RUN_SECONDS)

      await expect(overflowIn(page, 'ai')).toBeVisible()
      const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth)

      const human = await boxOf(laneLocator(page, 'human'))
      const ai = await boxOf(laneLocator(page, 'ai'))
      expect(human.y + human.height, 'lanes are stacked').toBeLessThanOrEqual(ai.y)

      for (const laneId of ['human', 'ai']) {
        const { inputs, queue, review, metrics } = await laneGroups(page, laneId)
        expect(inputs.y + inputs.height, `${laneId} inputs above queue`).toBeLessThanOrEqual(
          queue.y,
        )
        expect(queue.y + queue.height, `${laneId} queue above review`).toBeLessThanOrEqual(review.y)
        expect(review.y + review.height, `${laneId} review above metrics`).toBeLessThanOrEqual(
          metrics.y,
        )
      }

      await expectInsideViewport(buttonNamed(page, 'Pause'), PHONE)
      await expectInsideViewport(buttonNamed(page, 'Reset'), PHONE)
    })
  })

  test('Every control is keyboard reachable with a visible focus ring', async ({ page }) => {
    await openSimulator(page)
    const inTabOrder = [
      buttonNamed(page, 'Start'),
      buttonNamed(page, 'Reset'),
      slider(page, THRESHOLD_LABEL),
      slider(page, HUMAN_GEN_LABEL),
      slider(page, PR_SIZE_LABEL),
      slider(page, REVIEWER_SPEED_LABEL),
      slider(page, AI_GEN_LABEL),
      slider(page, AI_SKIM_LABEL),
    ]

    for (const control of inTabOrder) {
      await tabTo(page, control)
      const focusRing = await control.evaluate((element) => ({
        isFocusVisible: element.matches(':focus-visible'),
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineWidth: Number.parseFloat(getComputedStyle(element).outlineWidth),
      }))
      expect(focusRing.isFocusVisible).toBe(true)
      expect(focusRing.outlineStyle).not.toBe('none')
      expect(focusRing.outlineWidth).toBeGreaterThan(0)
    }
  })
})
