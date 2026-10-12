import {
  AI_CODE_WRITTEN_LABEL,
  AI_SKIM_LABEL,
  HUMAN_CODE_WRITTEN_LABEL,
  HUMAN_PRS_PER_DAY_LABEL,
  MIN_TEXT_CONTRAST,
  NARROWEST_PHONE,
  PHONE,
  REVIEWER_SPEED_LABEL,
  THRESHOLD_LABEL,
  UNSUPPORTED_WORDING,
  PROJECTOR,
  boxOf,
  contrastRatio,
  escapeRegExp,
  expect,
  expectNoHorizontalScroll,
  expectViewport,
  flushPendingRenders,
  infoButton,
  laneElementBoxes,
  openSimulator,
  pageTitle,
  runFor,
  slider,
  startSimulation,
  tabTo,
  test,
  textColors,
} from './fixtures.js'
import {
  centreOf,
  controlAfterLabel,
  labelOf,
  movePointerOnto,
  movePointerTo,
  overlaps,
  shownTips,
} from './tipHelpers.js'

test.describe.configure({ mode: 'parallel' })

// WCAG 2.5.8: a target is at least 24 × 24 CSS px.
const MIN_TARGET_PX = 24
// "Directly follows": the button sits on the label's row, at most this far to its right.
const MAX_LABEL_TO_BUTTON_GAP_PX = 8
const INFO_ICON = 'info'

// Each slider, in page order, and a phrase its tip must contain. Literal copies, never imported
// from src/laneConfig.js, so a change to a tip fails these tests.
const TIP_PHRASES = [
  [THRESHOLD_LABEL, 'turns red when its count is above this many PRs'],
  [HUMAN_CODE_WRITTEN_LABEL, 'lines of code the human lane writes, in LOC/hr'],
  [HUMAN_PRS_PER_DAY_LABEL, 'Below 1, a PR spans more than one day'],
  [
    AI_CODE_WRITTEN_LABEL,
    "The AI queue grows once this exceeds the AI lane's effective review speed",
  ],
  [REVIEWER_SPEED_LABEL, 'Defect discovery drops significantly faster than 500 LOC/hour'],
  [AI_SKIM_LABEL, 'AI PRs are reviewed 2× faster once picked up'],
]
const PHRASE_BY_CONTROL = Object.fromEntries(TIP_PHRASES)
const ALL_CONTROLS = TIP_PHRASES.map(([control]) => control)
// The outline's rows: the lane sliders. The threshold tip has its own scenario (it covers its slider).
const LANE_TIP_PHRASES = TIP_PHRASES.filter(([control]) => control !== THRESHOLD_LABEL)
// Sub-pixel layout: "touches" allows less than half a pixel between the tip and its button.
const TOUCH_DIGITS = 0

const NARROW_SCREENS = [
  ...ALL_CONTROLS.map((control) => ({ viewport: NARROWEST_PHONE, control })),
  { viewport: PHONE, control: AI_CODE_WRITTEN_LABEL },
]

// The tip a slider names as its accessible description (aria-describedby).
const tipFor = async (page, control) => {
  const tipId = await slider(page, control).getAttribute('aria-describedby')
  expect(tipId, `${control} slider names its tip`).toBeTruthy()
  return page.locator(`[role="tooltip"][id="${tipId}"]`)
}

const expectOneTipContaining = async (page, phrase) => {
  await expect(shownTips(page)).toHaveCount(1)
  await expect(shownTips(page)).toContainText(phrase)
}

// "Still" and "no" checks are made after any render the last action queued has committed.
const expectNoTipShown = async (page) => {
  await flushPendingRenders(page)
  await expect(shownTips(page)).toHaveCount(0)
}

const expectTipStillShown = async (page, control) => {
  await flushPendingRenders(page)
  await expect(await tipFor(page, control)).toBeVisible()
}

// Hovers a slider's info button and waits for its tip to show.
const hoverInfoButton = async (page, control) => {
  await movePointerTo(page, infoButton(page, control))
  await expect(await tipFor(page, control)).toBeVisible()
}

test.describe('Slider info tips', () => {
  for (const control of ALL_CONTROLS) {
    test(`Every slider has an info button after its label: ${control}`, async ({ page }) => {
      const button = infoButton(page, control)

      await test.step('Given I open the simulator', async () => {
        await openSimulator(page)
      })

      await test.step(`Then an "About ${control}" button with an "info" icon directly follows the "${control}" label`, async () => {
        await expect(button).toBeVisible()
        await expect(button.locator(`[data-icon="${INFO_ICON}"]`)).toHaveCount(1)
        expect(await controlAfterLabel(page, control), 'first control after the label').toBe(
          `About ${control}`,
        )
        const label = await boxOf(await labelOf(page, control), `${control} label`)
        const buttonBox = await boxOf(button, `About ${control}`)
        expect(buttonBox.x, 'button is right of the label').toBeGreaterThanOrEqual(
          label.x + label.width,
        )
        expect(buttonBox.x - (label.x + label.width), 'label-to-button gap').toBeLessThanOrEqual(
          MAX_LABEL_TO_BUTTON_GAP_PX,
        )
        expect(buttonBox.y, 'button starts on the label row').toBeLessThan(label.y + label.height)
      })

      await test.step('And the button is at least 24 by 24 pixels', async () => {
        const { width, height } = await boxOf(button, `About ${control}`)
        expect(width, 'button width').toBeGreaterThanOrEqual(MIN_TARGET_PX)
        expect(height, 'button height').toBeGreaterThanOrEqual(MIN_TARGET_PX)
      })
    })
  }

  for (const [control, phrase] of LANE_TIP_PHRASES) {
    test(`Each tip explains its slider and is the slider's description: ${control}`, async ({
      page,
    }) => {
      await test.step('Given I open the simulator', async () => {
        await openSimulator(page)
      })

      await test.step(`Then the "${control}" slider's accessible description contains "${phrase}"`, async () => {
        const description = new RegExp(escapeRegExp(phrase))
        await expect(slider(page, control)).toHaveAccessibleDescription(description)
        // The info button names the tip as its description too (APG tooltip pattern).
        await expect(infoButton(page, control)).toHaveAccessibleDescription(description)
      })

      await test.step(`When I hover "About ${control}"`, async () => {
        await movePointerTo(page, infoButton(page, control))
      })

      await test.step(`Then a tip is shown that contains "${phrase}"`, async () => {
        await expectOneTipContaining(page, phrase)
      })

      await test.step(`And the tip does not cover the "${control}" slider`, async () => {
        const tip = await boxOf(shownTips(page), 'tip')
        const sliderBox = await boxOf(slider(page, control), `${control} slider`)
        expect(overlaps(tip, sliderBox), 'tip overlaps the slider').toBe(false)
      })
    })
  }

  test('The warning-threshold tip opens below its button, covering the slider', async ({
    page,
  }) => {
    const phrase = PHRASE_BY_CONTROL[THRESHOLD_LABEL]
    const button = infoButton(page, THRESHOLD_LABEL)

    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step(`Then the "${THRESHOLD_LABEL}" slider's accessible description contains "${phrase}"`, async () => {
      await expect(slider(page, THRESHOLD_LABEL)).toHaveAccessibleDescription(
        new RegExp(escapeRegExp(phrase)),
      )
    })

    await test.step(`When I hover "About ${THRESHOLD_LABEL}"`, async () => {
      await movePointerTo(page, button)
    })

    await test.step(`Then a tip is shown that contains "${phrase}"`, async () => {
      await expectOneTipContaining(page, phrase)
    })

    await test.step(`And the tip's top edge touches the bottom of "About ${THRESHOLD_LABEL}"`, async () => {
      const tip = await boxOf(shownTips(page), 'tip')
      const buttonBox = await boxOf(button, `About ${THRESHOLD_LABEL}`)
      expect(tip.y, 'tip top at the button bottom').toBeCloseTo(
        buttonBox.y + buttonBox.height,
        TOUCH_DIGITS,
      )
    })

    await test.step(`And the tip covers the "${THRESHOLD_LABEL}" slider`, async () => {
      const tip = await boxOf(shownTips(page), 'tip')
      const sliderBox = await boxOf(slider(page, THRESHOLD_LABEL), `${THRESHOLD_LABEL} slider`)
      expect(overlaps(tip, sliderBox), 'tip overlaps the slider').toBe(true)
      // Covers: the tip, not the slider, is what the pointer finds at the slider's centre.
      const { x, y } = await centreOf(slider(page, THRESHOLD_LABEL))
      const topmostIsTip = await page.evaluate(
        ([pointX, pointY]) =>
          Boolean(document.elementFromPoint(pointX, pointY)?.closest('[role="tooltip"]')),
        [x, y],
      )
      expect(topmostIsTip, 'the tip is on top of the slider').toBe(true)
    })

    await test.step('When I move the pointer onto the tip', async () => {
      await movePointerOnto(page, button, await tipFor(page, THRESHOLD_LABEL))
    })

    await test.step('Then the tip is still shown', async () => {
      await expectTipStillShown(page, THRESHOLD_LABEL)
    })
  })

  // AA contrast for the tip text (plan, "Info tips": light text on a dark surface, at least 4.5:1).
  test('An open tip has AA text contrast', async ({ page }) => {
    await openSimulator(page)
    await movePointerTo(page, infoButton(page, REVIEWER_SPEED_LABEL))
    await expectOneTipContaining(page, PHRASE_BY_CONTROL[REVIEWER_SPEED_LABEL])

    const ratio = contrastRatio(await textColors(shownTips(page)))
    expect(ratio, 'tip text contrast').toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
  })

  test('The tip stays open while the pointer moves onto it', async ({ page }) => {
    await test.step('Given I hover "About Reviewer speed (LOC/hr, both lanes)"', async () => {
      await openSimulator(page)
      await hoverInfoButton(page, REVIEWER_SPEED_LABEL)
    })

    await test.step('When I move the pointer onto the tip', async () => {
      await movePointerOnto(
        page,
        infoButton(page, REVIEWER_SPEED_LABEL),
        await tipFor(page, REVIEWER_SPEED_LABEL),
      )
    })

    await test.step('Then the tip is still shown', async () => {
      await expectTipStillShown(page, REVIEWER_SPEED_LABEL)
    })
  })

  test('Moving the pointer away closes the tip', async ({ page }) => {
    await test.step('Given I hover "About Reviewer speed (LOC/hr, both lanes)"', async () => {
      await openSimulator(page)
      await hoverInfoButton(page, REVIEWER_SPEED_LABEL)
    })

    await test.step('When I move the pointer to the page title', async () => {
      await movePointerTo(page, pageTitle(page))
    })

    await test.step('Then no tip is shown', async () => {
      await expectNoTipShown(page)
    })
  })

  test('Keyboard focus opens the tip and Escape closes it', async ({ page }) => {
    const button = infoButton(page, AI_SKIM_LABEL)

    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I Tab to "About AI skim multiplier"', async () => {
      await tabTo(page, button)
    })

    await test.step('Then a tip is shown that contains "AI PRs are reviewed 2× faster once picked up"', async () => {
      await expectOneTipContaining(page, PHRASE_BY_CONTROL[AI_SKIM_LABEL])
    })

    await test.step('When I press Escape', async () => {
      await page.keyboard.press('Escape')
    })

    await test.step('Then no tip is shown', async () => {
      await expectNoTipShown(page)
    })

    await test.step('And focus is still on "About AI skim multiplier"', async () => {
      await expect(button).toBeFocused()
    })
  })

  test('Tabbing away from a focused info button closes its tip', async ({ page }) => {
    await test.step('Given I Tab to "About Human PRs per day"', async () => {
      await openSimulator(page)
      await tabTo(page, infoButton(page, HUMAN_PRS_PER_DAY_LABEL))
      await expect(await tipFor(page, HUMAN_PRS_PER_DAY_LABEL)).toBeVisible()
    })

    await test.step('When I press Tab', async () => {
      await page.keyboard.press('Tab')
    })

    await test.step('Then no tip is shown', async () => {
      await expectNoTipShown(page)
    })
  })

  // The Escape listener must exist by the time a tip first paints. A MutationObserver callback runs
  // after React's commit and before the browser paints or runs a passive effect, so an Escape sent
  // from it is exactly "Escape the moment the tip appears".
  test('Escape pressed the moment a hovered tip appears closes it', async ({ page }) => {
    await openSimulator(page)
    const tip = await tipFor(page, HUMAN_PRS_PER_DAY_LABEL)
    await tip.evaluate((element) => {
      const observer = new MutationObserver(() => {
        if (element.hidden) return
        observer.disconnect()
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        window.escapeSentOnAppear = true
      })
      observer.observe(element, { attributes: true, attributeFilter: ['hidden'] })
    })

    await movePointerTo(page, infoButton(page, HUMAN_PRS_PER_DAY_LABEL))

    await expect.poll(() => page.evaluate(() => window.escapeSentOnAppear)).toBe(true)
    await expectNoTipShown(page)
  })

  test('Clicking the info button toggles its tip', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I Tab to "About Warning threshold" and press Enter', async () => {
      await tabTo(page, infoButton(page, THRESHOLD_LABEL))
      await page.keyboard.press('Enter')
    })

    await test.step('And I press Tab', async () => {
      await page.keyboard.press('Tab')
      await expect(slider(page, THRESHOLD_LABEL)).toBeFocused()
    })

    await test.step('Then the tip for "About Warning threshold" is still shown', async () => {
      await expectTipStillShown(page, THRESHOLD_LABEL)
    })

    await test.step('When I press Shift+Tab and Enter', async () => {
      await page.keyboard.press('Shift+Tab')
      await expect(infoButton(page, THRESHOLD_LABEL)).toBeFocused()
      await page.keyboard.press('Enter')
    })

    await test.step('Then no tip is shown', async () => {
      await expectNoTipShown(page)
    })
  })

  test('A clicked tip stays open after the pointer leaves', async ({ page }) => {
    const button = infoButton(page, REVIEWER_SPEED_LABEL)
    const clickButton = async () => {
      const { x, y } = await centreOf(button)
      await page.mouse.click(x, y)
    }

    await test.step('Given I hover "About Reviewer speed (LOC/hr, both lanes)"', async () => {
      await openSimulator(page)
      await hoverInfoButton(page, REVIEWER_SPEED_LABEL)
    })

    await test.step('When I click "About Reviewer speed (LOC/hr, both lanes)"', async () => {
      await clickButton()
    })

    await test.step('And I move the pointer to the page title', async () => {
      await movePointerTo(page, pageTitle(page))
    })

    await test.step('Then the tip for "About Reviewer speed (LOC/hr, both lanes)" is still shown', async () => {
      await expectTipStillShown(page, REVIEWER_SPEED_LABEL)
    })

    await test.step('When I click "About Reviewer speed (LOC/hr, both lanes)" again', async () => {
      await clickButton()
    })

    await test.step('Then no tip is shown', async () => {
      await expectNoTipShown(page)
    })
  })

  test.describe('on a touch device', () => {
    test.use({ hasTouch: true })

    test('A tap opens a tip and a tap elsewhere closes it', async ({ page }) => {
      await test.step('Given I open the simulator on a touch device', async () => {
        await openSimulator(page)
        expect(await page.evaluate(() => navigator.maxTouchPoints), 'touch points').toBeGreaterThan(
          0,
        )
      })

      await test.step('When I tap "About AI code written (LOC/hr)"', async () => {
        // The same touchStart and touchEnd that locator.tap() sends, split so the test sees that a
        // touch entering the button is not a hover: no tip until the tap completes.
        const button = infoButton(page, AI_CODE_WRITTEN_LABEL)
        await button.scrollIntoViewIfNeeded()
        const { x, y } = await centreOf(button)
        const touchscreen = await page.context().newCDPSession(page)
        await touchscreen.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y }],
        })
        await expectNoTipShown(page)
        await touchscreen.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      })

      await test.step('Then the tip for "About AI code written (LOC/hr)" is shown', async () => {
        await expect(await tipFor(page, AI_CODE_WRITTEN_LABEL)).toBeVisible()
      })

      await test.step('When I tap the page title', async () => {
        await pageTitle(page).tap()
      })

      await test.step('Then no tip is shown', async () => {
        await expectNoTipShown(page)
      })
    })
  })

  test('Opening one tip closes the other', async ({ page }) => {
    await test.step('Given I hover "About Human PRs per day"', async () => {
      await openSimulator(page)
      await hoverInfoButton(page, HUMAN_PRS_PER_DAY_LABEL)
    })

    await test.step('When I Tab to "About Warning threshold"', async () => {
      await tabTo(page, infoButton(page, THRESHOLD_LABEL))
    })

    await test.step('Then exactly one tip is shown and it contains "turns red when its count is above this many PRs"', async () => {
      await flushPendingRenders(page)
      await expectOneTipContaining(page, PHRASE_BY_CONTROL[THRESHOLD_LABEL])
    })
  })

  test('Hovering the slider itself shows no tip', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I hover the "Reviewer speed (LOC/hr, both lanes)" slider', async () => {
      await movePointerTo(page, slider(page, REVIEWER_SPEED_LABEL))
    })

    await test.step('Then no tip is shown', async () => {
      await expectNoTipShown(page)
    })
  })

  test('Tips never use unsupported or misattributing wording', async ({ page }) => {
    const tipTexts = []

    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I hover each info button in turn', async () => {
      for (const control of ALL_CONTROLS) {
        await movePointerTo(page, infoButton(page, control))
        await expectOneTipContaining(page, PHRASE_BY_CONTROL[control])
        tipTexts.push(await shownTips(page).textContent())
      }
    })

    await test.step('Then no tip contains "near zero", "coined", or "originated"', async () => {
      expect(tipTexts, 'one tip read per slider').toHaveLength(ALL_CONTROLS.length)
      const misworded = tipTexts.filter((text) =>
        UNSUPPORTED_WORDING.some((phrase) => text.includes(phrase)),
      )
      expect(misworded).toEqual([])
    })
  })

  test('Opening a tip does not interrupt the simulation', async ({ page }) => {
    await test.step('Given the simulation is running', async () => {
      await openSimulator(page)
      await startSimulation(page)
    })

    await test.step('When I hover "About AI code written (LOC/hr)"', async () => {
      await hoverInfoButton(page, AI_CODE_WRITTEN_LABEL)
    })

    await test.step('Then the status still reads "Running"', async () => {
      // "Still" running: time keeps advancing the elapsed readout with the tip open.
      await runFor(page, 1)
      await expect(page.getByText('Running', { exact: true })).toBeVisible()
    })
  })

  test.describe('on a projector', () => {
    test.use({ viewport: PROJECTOR })

    test('Closed tips are hidden and take no space at 1280 × 720', async ({ page }) => {
      await test.step('Given the viewport is 1280 × 720', async () => {
        await openSimulator(page)
        await expectViewport(page, PROJECTOR)
      })

      await test.step('Then every tip is hidden and takes no space', async () => {
        const allTips = page.getByRole('tooltip', { includeHidden: true })
        await expect(allTips).toHaveCount(ALL_CONTROLS.length)
        for (const tip of await allTips.all()) {
          await expect(tip).toBeHidden()
          await expect(tip).toHaveCSS('display', 'none')
          expect(await tip.boundingBox(), 'a closed tip has no layout box').toBeNull()
        }
      })
    })

    test('Opening a tip moves no lane element', async ({ page }) => {
      let closedBoxes = []

      await test.step('Given the viewport is 1280 × 720', async () => {
        await openSimulator(page)
        await expectViewport(page, PROJECTOR)
        closedBoxes = await laneElementBoxes(page)
      })

      await test.step('When I hover "About Reviewer speed (LOC/hr, both lanes)"', async () => {
        await hoverInfoButton(page, REVIEWER_SPEED_LABEL)
      })

      await test.step('Then no element in either lane has moved', async () => {
        expect(closedBoxes.length, 'lane elements measured').toBeGreaterThan(0)
        expect(await laneElementBoxes(page)).toEqual(closedBoxes)
      })
    })
  })

  test.describe('on a phone, while the page scrolls', () => {
    test.use({ viewport: PHONE })

    // No scenario of its own: a lane tip that flips below (its slider scrolled near the viewport's
    // top) sits against its button, so the pointer glides from the button onto it without a gap.
    test('A tip opened below its button can be reached by the pointer', async ({ page }) => {
      const button = infoButton(page, REVIEWER_SPEED_LABEL)
      const NEAR_TOP_PX = 4

      await openSimulator(page)
      await button.evaluate((element, offset) => {
        window.scrollBy(0, element.getBoundingClientRect().top - offset)
      }, NEAR_TOP_PX)
      const { x, y } = await centreOf(button)
      await page.mouse.move(x, y)
      const tip = await tipFor(page, REVIEWER_SPEED_LABEL)
      await expect(tip).toBeVisible()

      const buttonBox = await boxOf(button, `About ${REVIEWER_SPEED_LABEL}`)
      await expect
        .poll(async () => (await boxOf(tip, 'tip')).y, 'tip top, flipped against the button')
        .toBeCloseTo(buttonBox.y + buttonBox.height, TOUCH_DIGITS)

      await movePointerOnto(page, button, tip)
      await expectTipStillShown(page, REVIEWER_SPEED_LABEL)
    })

    // The above-or-below choice is measured again on scroll, not only when the tip opens.
    test('A shown tip flips below and back as the page scrolls', async ({ page }) => {
      const button = infoButton(page, REVIEWER_SPEED_LABEL)
      // Scrolls so the tip's anchor (its offsetParent) starts `offset` px below the viewport's top,
      // and returns where it ended up.
      const scrollAnchorTo = (offset) =>
        shownTips(page).evaluate((tip, top) => {
          window.scrollBy(0, tip.offsetParent.getBoundingClientRect().top - top)
          return tip.offsetParent.getBoundingClientRect().top
        }, offset)
      const tipBox = () => boxOf(shownTips(page), 'tip')
      const buttonBox = () => boxOf(button, `About ${REVIEWER_SPEED_LABEL}`)

      await openSimulator(page)
      await tabTo(page, button)
      await expectOneTipContaining(page, PHRASE_BY_CONTROL[REVIEWER_SPEED_LABEL])

      expect(await scrollAnchorTo(0), 'anchor scrolled to the top').toBeCloseTo(0, 0)
      const { y: buttonTopAtTop } = await buttonBox()
      await expect
        .poll(async () => (await tipBox()).y, 'tip top, flipped below the button')
        .toBeGreaterThan(buttonTopAtTop)

      const middle = Math.floor(PHONE.height / 2)
      expect(await scrollAnchorTo(middle), 'anchor scrolled to the middle').toBeCloseTo(middle, 0)
      const { y: buttonTopAtMiddle } = await buttonBox()
      await expect
        .poll(async () => {
          const { y, height } = await tipBox()
          return y + height
        }, 'tip bottom, back above the button')
        .toBeLessThanOrEqual(buttonTopAtMiddle)
    })
  })

  for (const { viewport, control } of NARROW_SCREENS) {
    const size = `${viewport.width} × ${viewport.height}`

    test.describe(`at ${size}`, () => {
      test.use({ viewport })

      test(`An open tip fits a narrow screen: ${size} ${control}`, async ({ page }) => {
        await test.step(`Given the viewport is ${size}`, async () => {
          await openSimulator(page)
          await expectViewport(page, viewport)
        })

        await test.step(`When I Tab to "About ${control}"`, async () => {
          await tabTo(page, infoButton(page, control))
        })

        await test.step('Then the tip is fully inside the viewport', async () => {
          await expectOneTipContaining(page, PHRASE_BY_CONTROL[control])
          const { x, y, width, height } = await boxOf(shownTips(page), 'tip')
          expect(y, 'tip top').toBeGreaterThanOrEqual(0)
          expect(y + height, 'tip bottom').toBeLessThanOrEqual(viewport.height)
          expect(x, 'tip left').toBeGreaterThanOrEqual(0)
          expect(x + width, 'tip right').toBeLessThanOrEqual(viewport.width)
        })

        await test.step('And the page does not scroll horizontally', async () => {
          await expectNoHorizontalScroll(page)
        })
      })
    })
  }
})
