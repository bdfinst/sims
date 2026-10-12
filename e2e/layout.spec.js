import {
  AI_CODE_WRITTEN_LABEL,
  AI_SKIM_LABEL,
  BUSY_AI_PRESET,
  ALL_LANE_IDS,
  FULL_RUN_SECONDS,
  HUMAN_CODE_WRITTEN_LABEL,
  HUMAN_PRS_PER_DAY_LABEL,
  MIN_TEXT_CONTRAST,
  NARROWEST_PHONE,
  OVERFLOW_RUN_SECONDS,
  PHONE,
  PROJECTOR,
  RESEARCH_TITLE,
  REVIEWER_SPEED_LABEL,
  SLIDER_LABELS,
  boxOf,
  buttonNamed,
  contrastRatio,
  expect,
  expectSimulatorOpen,
  expectViewport,
  infoButton,
  expectNoHorizontalScroll,
  expectStrictlyIncreasing,
  headline,
  laneLocator,
  metric,
  metricsGrid,
  openAndReadCapacity,
  openWithSliders,
  openSimulator,
  overflowIn,
  queueBox,
  researchPanel,
  researchToggle,
  setSliders,
  slider,
  startAndRunFor,
  test,
  textColors,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

const DESKTOP = { width: 1280, height: 800 }
const TABLET = { width: 768, height: 1024 }
// --color-deployed (#22c55e) in src/index.css
const DEPLOYED_GREEN = 'rgb(34, 197, 94)'
const FOCUS_RING_COLOR = 'rgb(248, 250, 252)' // --color-focus (#f8fafc) in src/index.css
// The dark page: --color-canvas (#0b0d12) in src/index.css.
const PAGE_BACKGROUND = 'rgb(11, 13, 18)'
// Plan, "Layout": the metrics grid keeps one fixed row order in both lanes.
const METRIC_ROWS_TOP_TO_BOTTOM = [
  'deployed',
  'defectsCaught',
  'incidents',
  'incidentsPerPr',
  'pickupWait',
]
const GENERATION_LABELS = {
  human: [HUMAN_CODE_WRITTEN_LABEL, HUMAN_PRS_PER_DAY_LABEL],
  ai: [AI_CODE_WRITTEN_LABEL],
}
const REVIEW_LABELS = { human: REVIEWER_SPEED_LABEL, ai: AI_SKIM_LABEL }

// The right and bottom edges of a bounding box.
const rightOf = ({ x, width }) => x + width
const bottomOf = ({ y, height }) => y + height

const expectInsideViewport = async (locator, viewport, label) => {
  const { x, y, width, height } = await boxOf(locator, label)
  expect(y, `${label} top`).toBeGreaterThanOrEqual(0)
  expect(bottomOf({ y, height }), `${label} bottom`).toBeLessThanOrEqual(viewport.height)
  expect(x, `${label} left`).toBeGreaterThanOrEqual(0)
  expect(rightOf({ x, width }), `${label} right`).toBeLessThanOrEqual(viewport.width)
}

const expectAbove = (upper, lower, label) =>
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

      await test.step('Given the viewport is 1280 × 720', async () => {
        await expectViewport(page, PROJECTOR)
      })

      await test.step('And I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 30 seconds', async () => {
        await setSliders(page, BUSY_AI_PRESET)
        await startAndRunFor(page, OVERFLOW_RUN_SECONDS)
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
        expectStrictlyIncreasing(tops, `${laneId} rows are strictly top to bottom`)
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

      await test.step('And I set "AI code written (LOC/hr)" to 2000', async () => {
        await setSliders(page, BUSY_AI_PRESET)
      })

      await test.step('When I press Start and 30 seconds pass', async () => {
        await startAndRunFor(page, OVERFLOW_RUN_SECONDS)
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
        expectAbove(human, ai, 'lanes are stacked')
      })

      await test.step('And within each lane the inputs, the Pending Review box, and the review side appear top to bottom', async () => {
        for (const laneId of ALL_LANE_IDS) {
          const { inputs, queue, review, metrics } = await laneGroups(page, laneId)
          expectAbove(inputs.at(-1), queue, `${laneId} inputs above queue`)
          expectAbove(queue, review, `${laneId} queue above review`)
          expectAbove(review, metrics, `${laneId} review above metrics`)
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
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, OVERFLOW_RUN_SECONDS)

      await expect(overflowIn(page, 'ai')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  })

  test('Every control is keyboard reachable with a visible focus ring', async ({ page }) => {
    const inTabOrder = [
      ['Start', buttonNamed(page, 'Start')],
      ['Reset', buttonNamed(page, 'Reset')],
      ...SLIDER_LABELS.flatMap((label) => [
        [`About ${label}`, infoButton(page, label)],
        [label, slider(page, label)],
      ]),
      [RESEARCH_TITLE, researchToggle(page)],
    ]
    // The scenario's step line, verbatim. The Then step checks that inTabOrder lists the same
    // controls in the same order, so reordering SLIDER_LABELS alone fails the test.
    const FOCUS_ORDER_STEP =
      'Then focus visits, in order: Start, Reset, "About Warning threshold", "Warning threshold", "About Human code written (LOC/hr)", "Human code written (LOC/hr)", "About Human PRs per day", "Human PRs per day", "About Reviewer speed (LOC/hr, both lanes)", "Reviewer speed (LOC/hr, both lanes)", "About AI code written (LOC/hr)", "AI code written (LOC/hr)", "About AI skim multiplier", "AI skim multiplier", and "Research behind this simulation"'
    // One entry per Tab press: whether that press focused the expected control, and its focus ring.
    const stops = []
    let leftThePage = false

    await test.step('Given the queue tile capacity C is read from the queue box', async () => {
      await openAndReadCapacity(page)
    })

    await test.step('Given I open the simulator', async () => {
      await expectSimulatorOpen(page)
    })

    await test.step('When I Tab through the page', async () => {
      for (const [name, control] of inTabOrder) {
        await page.keyboard.press('Tab')
        const focus = await control.evaluate((element) => ({
          isFocused: element === document.activeElement,
          isFocusVisible: element.matches(':focus-visible'),
          outlineStyle: getComputedStyle(element).outlineStyle,
          outlineWidth: Number.parseFloat(getComputedStyle(element).outlineWidth),
          outlineColor: getComputedStyle(element).outlineColor,
        }))
        stops.push({ name, ...focus })
      }
      // One more press: with no further tab stop, focus leaves the page.
      await page.keyboard.press('Tab')
      leftThePage = await page.evaluate(
        () => document.activeElement === null || document.activeElement === document.body,
      )
    })

    await test.step(FOCUS_ORDER_STEP, async () => {
      const stepNames = inTabOrder.map(([name]) => (name.includes(' ') ? `"${name}"` : name))
      expect(
        `Then focus visits, in order: ${stepNames.slice(0, -1).join(', ')}, and ${stepNames.at(-1)}`,
        'the Tab order walked is the order the step line lists',
      ).toBe(FOCUS_ORDER_STEP)
      expect(
        stops.map(({ name, isFocused }) => [name, isFocused]),
        'each Tab press focused the next control in order',
      ).toEqual(inTabOrder.map(([name]) => [name, true]))
      expect(leftThePage, 'no tab stop follows the research toggle').toBe(true)
    })

    await test.step('And each has an accessible name and a non-none outline when focused', async () => {
      for (const [index, [name, control]] of inTabOrder.entries()) {
        const focusRing = stops[index]
        await expect(control).toHaveAccessibleName(name)
        expect(focusRing.isFocusVisible, `${name} matches :focus-visible`).toBe(true)
        expect(focusRing.outlineStyle, `${name} outline style`).not.toBe('none')
        expect(focusRing.outlineWidth, `${name} outline width`).toBeGreaterThan(0)
        expect(focusRing.outlineColor, `${name} focus ring colour`).toBe(FOCUS_RING_COLOR)
      }
    })
  })
})
