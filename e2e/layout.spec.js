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
  expectSimulatorOpen,
  expectViewport,
  expectNoHorizontalScroll,
  headline,
  laneLocator,
  metric,
  openSimulator,
  overflowIn,
  queueBox,
  readTileCapacity,
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
// --color-deployed (#22c55e) in src/index.css
const DEPLOYED_GREEN = 'rgb(34, 197, 94)'
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

// Background of every scenario in this feature: C is read from the queue box, so the page is
// opened here (the box does not exist before it).
const openAndReadCapacity = async (page) => {
  await openSimulator(page)
  expect(await readTileCapacity(page), 'queue tile capacity C').toBeGreaterThan(0)
}

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
      await test.step('Given the queue tile capacity C is read from the queue box', async () => {
        await openAndReadCapacity(page)
      })

      await test.step('Given the viewport is 1280 × 720 and the simulation has run for 10 seconds', async () => {
        await expectViewport(page, PROJECTOR)
        await startAndRunFor(page, FULL_RUN_SECONDS)
      })

      await test.step("Then the header, the headline ratio, and both lanes' Pending Review counts and metric grids are fully visible without scrolling", async () => {
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
  })

  test.describe('on a desktop', () => {
    test.use({ viewport: DESKTOP })

    test('Metric rows line up across lanes', async ({ page }) => {
      await test.step('Given the queue tile capacity C is read from the queue box', async () => {
        await openAndReadCapacity(page)
      })

      await test.step('Given the viewport is 1280 × 800', async () => {
        await expectViewport(page, DESKTOP)
      })

      await test.step('Then each metric row in the Human lane has the same left edge as the matching row in the AI lane', async () => {
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
      await test.step('Given the queue tile capacity C is read from the queue box', async () => {
        await openAndReadCapacity(page)
      })

      await test.step('Given the viewport is 1280 × 800', async () => {
        await expectViewport(page, DESKTOP)
      })

      await test.step('Then within each lane the inputs, the Pending Review box, and the review side appear left to right', async () => {
        for (const laneId of ALL_LANE_IDS) {
          const { inputs, queue, review, metrics } = await laneGroups(page, laneId)
          for (const input of inputs) expectLeftOf(input, queue, `${laneId} inputs left of queue`)
          expectLeftOf(queue, review, `${laneId} queue left of review controls`)
          expectLeftOf(review, metrics, `${laneId} review controls left of metrics`)
        }
      })

      await test.step('And the Start/Pause and Reset buttons sit to the right of the title', async () => {
        const title = await boxOf(page.getByRole('heading', { level: 1 }), 'title')
        for (const name of ['Start', 'Reset']) {
          const button = await boxOf(buttonNamed(page, name), name)
          expect(button.x, `${name} is right of the title`).toBeGreaterThanOrEqual(rightOf(title))
        }
      })
    })

    // AC13: the Deployed value is green in the lanes.
    test('Deployed values are green', async ({ page }) => {
      await openSimulator(page)

      for (const laneId of ALL_LANE_IDS) {
        await expect(metric(page, laneId, 'deployed')).toHaveCSS('color', DEPLOYED_GREEN)
      }
    })

    test('Dark theme', async ({ page }) => {
      await test.step('Given the queue tile capacity C is read from the queue box', async () => {
        await openAndReadCapacity(page)
      })

      await test.step('Given I open the simulator', async () => {
        await expectSimulatorOpen(page)
      })

      await test.step('Then the page background color is rgb(11, 13, 18)', async () => {
        await expect(page.locator('body')).toHaveCSS('background-color', PAGE_BACKGROUND)
      })
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
      await test.step('Given the queue tile capacity C is read from the queue box', async () => {
        await openAndReadCapacity(page)
      })

      await test.step('Given the viewport is 375 × 667', async () => {
        await expectViewport(page, PHONE)
      })

      await test.step('When I press Start and 10 seconds pass', async () => {
        await startAndRunFor(page, FULL_RUN_SECONDS)
      })

      await test.step('Then the AI lane shows a "+N more" indicator', async () => {
        await expect(overflowIn(page, 'ai')).toBeVisible()
      })

      await test.step('And the page does not scroll horizontally', async () => {
        await expectNoHorizontalScroll(page)
      })

      await test.step('And the two lanes are stacked one above the other', async () => {
        const human = await boxOf(laneLocator(page, 'human'), 'human lane')
        const ai = await boxOf(laneLocator(page, 'ai'), 'ai lane')
        expectStackedBelow(human, ai, 'lanes are stacked')
      })

      await test.step('And within each lane the inputs, the Pending Review box, and the review side appear top to bottom', async () => {
        for (const laneId of ALL_LANE_IDS) {
          const { inputs, queue, review, metrics } = await laneGroups(page, laneId)
          expectStackedBelow(inputs.at(-1), queue, `${laneId} inputs above queue`)
          expectStackedBelow(queue, review, `${laneId} queue above review`)
          expectStackedBelow(review, metrics, `${laneId} review above metrics`)
        }
      })

      await test.step('And the Start/Pause and Reset buttons are visible without scrolling', async () => {
        await expectInsideViewport(buttonNamed(page, 'Pause'), PHONE, 'Start/Pause button')
        await expectInsideViewport(buttonNamed(page, 'Reset'), PHONE, 'Reset button')
      })
    })
  })

  test.describe('on a phone header', () => {
    test.use({ viewport: PHONE })

    // AC14: below md, Start/Pause and Reset sit together on their own row, under the title.
    test('Start and Reset share their own row below the title and description', async ({
      page,
    }) => {
      await openSimulator(page)

      const description = await boxOf(
        page.getByText('Watch AI-speed code generation'),
        'description',
      )
      const start = await boxOf(buttonNamed(page, 'Start'), 'Start')
      const reset = await boxOf(buttonNamed(page, 'Reset'), 'Reset')
      // Same row: their vertical extents overlap (the bordered Reset is 2 px taller, so tops differ).
      expect(reset.y, 'Reset starts above the bottom of Start').toBeLessThan(bottomOf(start))
      expect(start.y, 'Start starts above the bottom of Reset').toBeLessThan(bottomOf(reset))
      expect(start.y, 'buttons are below the description').toBeGreaterThanOrEqual(
        bottomOf(description),
      )
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
    const tookFocus = {}

    await test.step('Given the queue tile capacity C is read from the queue box', async () => {
      await openAndReadCapacity(page)
    })

    await test.step('Given I open the simulator', async () => {
      await expectSimulatorOpen(page)
    })

    await test.step('When I Tab through the page', async () => {
      for (const [name, control] of inTabOrder) {
        await page.keyboard.press('Tab')
        tookFocus[name] = await control.evaluate((element) => element === document.activeElement)
      }
    })

    await test.step('Then focus visits Start, Reset, the threshold slider, and all five model sliders', async () => {
      const expected = Object.fromEntries(inTabOrder.map(([name]) => [name, true]))
      expect(tookFocus, 'each control took focus, in Tab order').toEqual(expected)
    })

    await test.step('And each has an accessible name and a non-none outline when focused', async () => {
      // Focus is on the last control after the Tab pass; Shift+Tab walks back through each one.
      for (let index = inTabOrder.length - 1; index >= 0; index -= 1) {
        const [name, control] = inTabOrder[index]
        await expect(control, `${name} holds focus`).toBeFocused()
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
        if (index > 0) await page.keyboard.press('Shift+Tab')
      }
    })
  })
})
