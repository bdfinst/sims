import {
  MIN_TEXT_CONTRAST,
  NARROWEST_PHONE,
  PHONE,
  advanceSeconds,
  contrastRatio,
  expect,
  expectNoHorizontalScroll,
  expectViewport,
  openResearchPanel,
  openSimulator,
  researchPanel,
  researchToggle,
  sourceLink,
  startAndRunFor,
  tabTo,
  test,
  textColors,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

// Independent oracles (see fixtures.js): the spec's Research Sources table, not src/research.js.
// `wording` is the "Panel wording" column; `label` is how the link names its source.
const SOURCES = [
  {
    wording: '2,500 reviews of 3.2 million lines of code over 10 months',
    label: 'SmartBear, Cisco Systems / Collaborator case study',
    url: 'https://smartbear.com/resources/case-studies/cisco-systems-collaborator/',
  },
  {
    wording:
      'Review no more than 200–400 LOC at a time; beyond 400 LOC the ability to find defects diminishes. 200–400 LOC over 60–90 minutes yields 70–90% defect discovery. Defect discovery drops significantly faster than 500 LOC/hour.',
    label: 'SmartBear, Best Practices for Code Review',
    url: 'https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/',
  },
  {
    wording:
      'Across 22,000 developers in 4,000 teams, high AI adoption saw PR size +51% and 3× incidents per PR (+242.7%), compared with low adoption.',
    label: 'Faros AI, AI Engineering Report Q2 2026: The Acceleration Whiplash',
    url: 'https://faros.ai/research/ai-acceleration-whiplash',
  },
  {
    wording:
      'AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up (8.1M+ PRs, 4,800+ orgs).',
    label: 'LinearB, 2026 Software Engineering Benchmarks Report',
    url: 'https://linearb.io/blog/engineering-benchmarks-report',
  },
  {
    wording:
      'A practitioner observation, not a research finding: "AI code is often locally coherent but globally brittle."',
    label: 'Example: Tian Pan, The AI Code Review Inversion',
    url: 'https://tianpan.co/blog/2026-05-07-ai-code-review-inversion-reviewing-machine-authored-code',
  },
]
const NEW_TAB_NOTICE = ' (opens in new tab)'
const FORBIDDEN_PHRASES = ['near zero', 'coined', 'originated']
const ASSUMPTIONS_START = 'Model assumptions'
const ASSUMPTION_PHRASES = [
  'These are modeling choices, not research findings',
  'the defect density (20 defects per 1,000 LOC)',
  "the base detection rate (0.8, picked from SmartBear's 70–90% range)",
  'the detection floors (0.05 for large PRs and 0.1 for fast reviewing)',
  'the curve thresholds (PR size 200 to 400 LOC, reviewer speed 500 to 1,000 LOC/hr)',
  'the 1.51 size multiplier',
]
const CALIBRATION_SENTENCE =
  "The defaults were calibrated to land near Faros's +242.7% incidents per PR"
const FAROS_URL = SOURCES[2].url
const SECONDS_BEFORE_EXPANDING = 1
const SECONDS_AFTER_EXPANDING = 1

const assumptionsParagraph = (page) =>
  researchPanel(page).locator('p', { hasText: ASSUMPTIONS_START })

test.describe('Research behind the simulation', () => {
  test('Panel is collapsed by default', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('Then the "Research behind this simulation" toggle is collapsed', async () => {
      await expect(researchToggle(page)).toBeVisible()
      await expect(researchPanel(page)).not.toHaveAttribute('open')
    })

    await test.step('And no research findings are visible', async () => {
      const hiddenContent = [
        ...SOURCES.map(({ wording }) => researchPanel(page).getByText(wording)),
        assumptionsParagraph(page),
      ]
      for (const content of hiddenContent) {
        await expect(content, 'is in the page').toHaveCount(1)
        await expect(content, 'is not visible').toBeHidden()
      }
    })
  })

  test('Expanding shows every finding verbatim with its source', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I expand "Research behind this simulation"', async () => {
      await openResearchPanel(page)
    })

    await test.step('Then the panel contains "2,500 reviews of 3.2 million lines of code over 10 months"', async () => {
      await expect(
        researchPanel(page).getByText(SOURCES[0].wording),
        SOURCES[0].label,
      ).toBeVisible()
    })

    await test.step('And the panel contains "Review no more than 200–400 LOC at a time"', async () => {
      await expect(
        researchPanel(page).getByText(SOURCES[1].wording),
        SOURCES[1].label,
      ).toBeVisible()
    })

    await test.step('And the panel contains "faster than 500 LOC/hour"', async () => {
      await expect(researchPanel(page)).toContainText('faster than 500 LOC/hour')
    })

    await test.step('And the panel contains "PR size +51%" and "(+242.7%)"', async () => {
      await expect(
        researchPanel(page).getByText(SOURCES[2].wording),
        SOURCES[2].label,
      ).toBeVisible()
    })

    await test.step('And the panel contains "AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up"', async () => {
      await expect(
        researchPanel(page).getByText(SOURCES[3].wording),
        SOURCES[3].label,
      ).toBeVisible()
    })

    await test.step('And the panel contains "practitioner observation" and "locally coherent but globally brittle"', async () => {
      await expect(
        researchPanel(page).getByText(SOURCES[4].wording),
        SOURCES[4].label,
      ).toBeVisible()
    })

    await test.step("And the panel links to all five source URLs from the spec's Research Sources table, each opening in a new tab", async () => {
      for (const { label, url } of SOURCES) {
        const link = sourceLink(page, url)
        await expect(link, url).toHaveCount(1)
        await expect(link, `${url} opens in a new tab`).toHaveAttribute('target', '_blank')
        await expect(link, `${url} protects the opener`).toHaveAttribute('rel', /noopener/)
        await expect(link, `${url} is named by its source`).toHaveAccessibleName(
          `${label}${NEW_TAB_NOTICE}`,
        )
      }
    })
  })

  // No scenario of its own: the plan's accessibility rule (WCAG 1.4.3) applied to the panel's links.
  test('Links have sufficient contrast', async ({ page }) => {
    await openSimulator(page)
    await openResearchPanel(page)

    for (const { url } of SOURCES) {
      const ratio = contrastRatio(await textColors(sourceLink(page, url)))
      expect(ratio, url).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
    }
  })

  test('Unsupported or misattributing wording never appears', async ({ page }) => {
    await test.step('Given I expand "Research behind this simulation"', async () => {
      await openSimulator(page)
      await openResearchPanel(page)
    })

    await test.step('Then the page does not contain "near zero", "coined", or "originated"', async () => {
      const pageText = (await page.locator('body').innerText()).toLowerCase()
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(pageText, `page text contains "${phrase}"`).not.toContain(phrase)
      }
    })
  })

  test('Model assumptions and calibration are stated', async ({ page }) => {
    await test.step('Given I expand "Research behind this simulation"', async () => {
      await openSimulator(page)
      await openResearchPanel(page)
    })

    await test.step('Then the panel states that defect density, the base detection rate, the detection floors, the curve thresholds, and the 1.51 size multiplier are modeling choices', async () => {
      for (const phrase of ASSUMPTION_PHRASES) {
        await expect(assumptionsParagraph(page)).toContainText(phrase)
      }
    })

    await test.step("And the panel states that the defaults were calibrated to land near Faros's +242.7% incidents per PR", async () => {
      const note = assumptionsParagraph(page)
      await expect(note).toContainText(CALIBRATION_SENTENCE)
      await expect(
        note.locator(`a[href="${FAROS_URL}"]`),
        'the figure links its source',
      ).toHaveCount(1)
    })
  })

  test('Panel is keyboard operable and does not interrupt the simulation', async ({ page }) => {
    await test.step('Given the simulation is running', async () => {
      await openSimulator(page)
      await startAndRunFor(page, SECONDS_BEFORE_EXPANDING)
    })

    await test.step('When I Tab to the research toggle and press Enter', async () => {
      await tabTo(page, researchToggle(page))
      await page.keyboard.press('Enter')
    })

    await test.step('Then the panel expands and the status still reads "Running"', async () => {
      await expect(researchPanel(page)).toHaveAttribute('open', '')
      await expect(page.getByText('Running', { exact: true })).toBeVisible()
      await advanceSeconds(
        page,
        SECONDS_AFTER_EXPANDING,
        SECONDS_BEFORE_EXPANDING + SECONDS_AFTER_EXPANDING,
      )
    })
  })

  test.describe('on a phone', () => {
    test.use({ viewport: PHONE })

    test('Panel fits a phone', async ({ page }) => {
      await test.step('Given the viewport is 375 × 667', async () => {
        await openSimulator(page)
        await expectViewport(page, PHONE)
      })

      await test.step('When I expand "Research behind this simulation"', async () => {
        await openResearchPanel(page)
      })

      await test.step('Then the page does not scroll horizontally', async () => {
        await expectNoHorizontalScroll(page)
      })
    })
  })

  test.describe('on the narrowest phone', () => {
    test.use({ viewport: NARROWEST_PHONE })

    // No scenario of its own: the plan's 320 px reflow rule (WCAG 1.4.10) applied to the panel.
    test('Panel fits a 320 px screen', async ({ page }) => {
      await openSimulator(page)

      await openResearchPanel(page)

      await expectNoHorizontalScroll(page)
    })
  })
})
