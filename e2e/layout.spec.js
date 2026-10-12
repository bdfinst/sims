import {
  AI_GEN_LABEL,
  AI_SKIM_LABEL,
  ALL_LANE_IDS,
  FULL_RUN_SECONDS,
  HUMAN_GEN_LABEL,
  MIN_TEXT_CONTRAST,
  NARROWEST_PHONE,
  PAGE_BACKGROUND,
  PHONE,
  PR_SIZE_LABEL,
  RESEARCH_TITLE,
  REVIEWER_SPEED_LABEL,
  THRESHOLD_LABEL,
  buttonNamed,
  contrastRatio,
  expect,
  expectNoHorizontalScroll,
  headline,
  laneLocator,
  metric,
  openSimulator,
  overflowIn,
  queueBox,
  bottomOf,
  researchPanel,
  researchToggle,
  rightOf,
  slider,
  startAndRunFor,
  test,
  textColors,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

const PROJECTOR = { width: 1280, height: 720 }
const DESKTOP = { width: 1280, height: 800 }
const TABLET = { width: 768, height: 1024 }
const FOCUS_RING_COLOR = 'rgb(248, 250, 252)' // --color-focus (#f8fafc) in src/index.css
// Plan, "Layout": the metrics grid keeps one fixed row order in both lanes.
const METRIC_ROWS_TOP_TO_BOTTOM = [
  'deployed',
  'defectsCaught',
  'incidents',
  'incidentsPerPr',
  'pickupWait',
]
const GENERATION_LABELS = {
  human: [HUMAN_GEN_LABEL, PR_SIZE_LABEL],
  ai: [AI_GEN_LABEL],
}
const REVIEW_LABELS = { human: REVIEWER_SPEED_LABEL, ai: AI_SKIM_LABEL }

const boxOf = async (locator, label) => {
  const box = await locator.boundingBox()
  expect(box, `${label} has a layout box`).not.toBeNull()
  return box
}

const metricsGrid = (page, laneId) =>
  laneLocator(page, laneId).locator('dl', { has: page.locator('[data-metric="incidents"]') })

const expectInsideViewport = async (locator, viewport, label) => {
  const { x, y, width, height } = await boxOf(locator, label)
  expect(y, `${label} top`).toBeGreaterThanOrEqual(0)
  expect(bottomOf({ y, height }), `${label} bottom`).toBeLessThanOrEqual(viewport.height)
  expect(x, `${label} left`).toBeGreaterThanOrEqual(0)
  expect(rightOf({ x, width }), `${label} right`).toBeLessThanOrEqual(viewport.width)
}

const expectStackedBelow = (upper, lower, label) =>
  expect(bottomOf(upper), label).toBeLessThanOrEqual(lower.y)

const expectLeftOf = (left, right, label) =>
  expect(rightOf(left), label).toBeLessThanOrEqual(right.x)

// The positions of a lane's groups: inputs (every generation slider), Pending Review box, review
// controls, and metrics grid.
const laneGroups = async (page, laneId) => {
  const inputs = []
  for (const label of GENERATION_LABELS[laneId]) {
    inputs.push(await boxOf(slider(page, label), `${laneId} ${label}`))
  }
  return {
    inputs,
    queue: await boxOf(queueBox(page, laneId), `${laneId} queue`),
    review: await boxOf(slider(page, REVIEW_LABELS[laneId]), `${laneId} review slider`),
    metrics: await boxOf(metricsGrid(page, laneId), `${laneId} metrics`),
  }
}

test.describe('Pending Review layout', () => {
  test.describe('on a projector', () => {
    test.use({ viewport: PROJECTOR })

    test('Projector fit at 1280 × 720', async ({ page }) => {
      await openSimulator(page)
      await startAndRunFor(page, FULL_RUN_SECONDS)

      await expect(researchPanel(page), 'research panel is collapsed').not.toHaveAttribute('open')
      await expectInsideViewport(page.getByRole('banner'), PROJECTOR, 'header')
      await expectInsideViewport(headline(page), PROJECTOR, 'headline ratio')
      for (const laneId of ALL_LANE_IDS) {
        await expectInsideViewport(metric(page, laneId, 'pending'), PROJECTOR, `${laneId} count`)
        await expectInsideViewport(metricsGrid(page, laneId), PROJECTOR, `${laneId} metrics`)
        await expectInsideViewport(laneLocator(page, laneId), PROJECTOR, `${laneId} lane`)
      }
    })
  })

  test.describe('on a desktop', () => {
    test.use({ viewport: DESKTOP })

    test('Metric rows line up across lanes', async ({ page }) => {
      await openSimulator(page)

      for (const row of METRIC_ROWS_TOP_TO_BOTTOM) {
        const human = await boxOf(metric(page, 'human', row), `human ${row}`)
        const ai = await boxOf(metric(page, 'ai', row), `ai ${row}`)
        expect(ai.x, `${row} value left edge`).toBe(human.x)
      }
      const humanLabels = metricsGrid(page, 'human').locator('dt')
      const aiLabels = metricsGrid(page, 'ai').locator('dt')
      for (let row = 0; row < METRIC_ROWS_TOP_TO_BOTTOM.length; row += 1) {
        const human = await boxOf(humanLabels.nth(row), `human label ${row}`)
        const ai = await boxOf(aiLabels.nth(row), `ai label ${row}`)
        expect(ai.x, `label ${row} left edge`).toBe(human.x)
      }
    })

    test('Metric rows keep one fixed order in both lanes', async ({ page }) => {
      await openSimulator(page)

      for (const laneId of ALL_LANE_IDS) {
        const tops = []
        for (const row of METRIC_ROWS_TOP_TO_BOTTOM) {
          tops.push((await boxOf(metric(page, laneId, row), `${laneId} ${row}`)).y)
        }
        expect(
          tops.slice(1).every((top, index) => top > tops[index]),
          `${laneId} rows are strictly top to bottom`,
        ).toBe(true)
      }
    })

    test('Wide layout reads left to right', async ({ page }) => {
      await openSimulator(page)

      for (const laneId of ALL_LANE_IDS) {
        const { inputs, queue, review, metrics } = await laneGroups(page, laneId)
        for (const input of inputs) expectLeftOf(input, queue, `${laneId} inputs left of queue`)
        expectLeftOf(queue, review, `${laneId} queue left of review controls`)
        expectLeftOf(review, metrics, `${laneId} review controls left of metrics`)
      }
      const title = await boxOf(page.getByRole('heading', { level: 1 }), 'title')
      for (const name of ['Start', 'Reset']) {
        const button = await boxOf(buttonNamed(page, name), name)
        expect(button.x, `${name} is right of the title`).toBeGreaterThanOrEqual(rightOf(title))
      }
    })

    test('Dark theme', async ({ page }) => {
      await openSimulator(page)

      await expect(page.locator('body')).toHaveCSS('background-color', PAGE_BACKGROUND)
    })

    test('Text contrasts with its background (WCAG 1.4.3)', async ({ page }) => {
      await openSimulator(page)
      const texts = {
        'Start button': buttonNamed(page, 'Start'),
        'Reset button': buttonNamed(page, 'Reset'),
        'description under the title': page.getByText('Watch AI-speed code generation'),
        'elapsed caption': page.getByText('1 s = 1 work hour'),
      }

      for (const [label, locator] of Object.entries(texts)) {
        const ratio = contrastRatio(await textColors(locator))
        expect(ratio, `${label} contrast`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
      }
    })
  })

  test.describe('on a tablet', () => {
    test.use({ viewport: TABLET })

    test('Metric values stay inside their lane at the md breakpoint', async ({ page }) => {
      await openSimulator(page)
      await startAndRunFor(page, FULL_RUN_SECONDS)

      await expectNoHorizontalScroll(page)
      for (const laneId of ALL_LANE_IDS) {
        const lane = await boxOf(laneLocator(page, laneId), `${laneId} lane`)
        const grid = await boxOf(metricsGrid(page, laneId), `${laneId} metrics`)
        for (const row of METRIC_ROWS_TOP_TO_BOTTOM) {
          const value = await boxOf(metric(page, laneId, row), `${laneId} ${row}`)
          expect(rightOf(value), `${laneId} ${row} inside metrics grid`).toBeLessThanOrEqual(
            rightOf(grid),
          )
          expect(rightOf(value), `${laneId} ${row} inside lane`).toBeLessThanOrEqual(rightOf(lane))
        }
      }
    })
  })

  test.describe('on a phone', () => {
    test.use({ viewport: PHONE })

    test('No horizontal scroll on a phone, even when overflowing', async ({ page }) => {
      await openSimulator(page)
      await startAndRunFor(page, FULL_RUN_SECONDS)

      await expect(overflowIn(page, 'ai')).toBeVisible()
      await expectNoHorizontalScroll(page)

      const human = await boxOf(laneLocator(page, 'human'), 'human lane')
      const ai = await boxOf(laneLocator(page, 'ai'), 'ai lane')
      expectStackedBelow(human, ai, 'lanes are stacked')

      for (const laneId of ALL_LANE_IDS) {
        const { inputs, queue, review, metrics } = await laneGroups(page, laneId)
        expectStackedBelow(inputs.at(-1), queue, `${laneId} inputs above queue`)
        expectStackedBelow(queue, review, `${laneId} queue above review`)
        expectStackedBelow(review, metrics, `${laneId} review above metrics`)
      }

      await expectInsideViewport(buttonNamed(page, 'Pause'), PHONE, 'Start/Pause button')
      await expectInsideViewport(buttonNamed(page, 'Reset'), PHONE, 'Reset button')
    })
  })

  test.describe('on the narrowest phone', () => {
    test.use({ viewport: NARROWEST_PHONE })

    test('No horizontal scroll at 320 px, even when overflowing', async ({ page }) => {
      await openSimulator(page)
      await startAndRunFor(page, FULL_RUN_SECONDS)

      await expect(overflowIn(page, 'ai')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  })

  test('Every control is keyboard reachable with a visible focus ring', async ({ page }) => {
    await openSimulator(page)
    const inTabOrder = [
      ['Start', buttonNamed(page, 'Start')],
      ['Reset', buttonNamed(page, 'Reset')],
      [THRESHOLD_LABEL, slider(page, THRESHOLD_LABEL)],
      [HUMAN_GEN_LABEL, slider(page, HUMAN_GEN_LABEL)],
      [PR_SIZE_LABEL, slider(page, PR_SIZE_LABEL)],
      [REVIEWER_SPEED_LABEL, slider(page, REVIEWER_SPEED_LABEL)],
      [AI_GEN_LABEL, slider(page, AI_GEN_LABEL)],
      [AI_SKIM_LABEL, slider(page, AI_SKIM_LABEL)],
      [RESEARCH_TITLE, researchToggle(page)],
    ]

    for (const [name, control] of inTabOrder) {
      await page.keyboard.press('Tab')
      await expect(control, `${name} is next in the Tab order`).toBeFocused()
      await expect(control).toHaveAccessibleName(name)
      await expect(control, `${name} focus ring colour`).toHaveCSS(
        'outline-color',
        FOCUS_RING_COLOR,
      )
      const focusRing = await control.evaluate((element) => ({
        isFocusVisible: element.matches(':focus-visible'),
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineWidth: Number.parseFloat(getComputedStyle(element).outlineWidth),
      }))
      expect(focusRing.isFocusVisible, `${name} matches :focus-visible`).toBe(true)
      expect(focusRing.outlineStyle, `${name} outline style`).not.toBe('none')
      expect(focusRing.outlineWidth, `${name} outline width`).toBeGreaterThan(0)
    }
  })
})
