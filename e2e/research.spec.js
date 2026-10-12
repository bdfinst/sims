import {
  MIN_TEXT_CONTRAST,
  NARROWEST_PHONE,
  PHONE,
  advanceSeconds,
  contrastRatio,
  expect,
  expectNoHorizontalScroll,
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
    await openSimulator(page)

    await expect(researchToggle(page)).toBeVisible()
    await expect(researchPanel(page)).not.toHaveAttribute('open')
    const hiddenContent = [
      ...SOURCES.map(({ wording }) => researchPanel(page).getByText(wording)),
      assumptionsParagraph(page),
    ]
    for (const content of hiddenContent) {
      await expect(content, 'is in the page').toHaveCount(1)
      await expect(content, 'is not visible').toBeHidden()
    }
  })

  test('Expanding shows every finding verbatim with its source', async ({ page }) => {
    await openSimulator(page)

    await openResearchPanel(page)

    for (const { wording, label, url } of SOURCES) {
      await expect(researchPanel(page).getByText(wording), label).toBeVisible()
      const link = sourceLink(page, url)
      await expect(link, url).toHaveCount(1)
      await expect(link, `${url} opens in a new tab`).toHaveAttribute('target', '_blank')
      await expect(link, `${url} protects the opener`).toHaveAttribute('rel', /noopener/)
      await expect(link, `${url} is named by its source`).toHaveAccessibleName(
        `${label}${NEW_TAB_NOTICE}`,
      )
    }
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
    await openSimulator(page)
    await openResearchPanel(page)

    const pageText = (await page.locator('body').innerText()).toLowerCase()
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(pageText, `page text contains "${phrase}"`).not.toContain(phrase)
    }
  })

  test('Model assumptions and calibration are stated', async ({ page }) => {
    await openSimulator(page)
    await openResearchPanel(page)

    const note = assumptionsParagraph(page)
    for (const phrase of [...ASSUMPTION_PHRASES, CALIBRATION_SENTENCE]) {
      await expect(note).toContainText(phrase)
    }
    await expect(note.locator(`a[href="${FAROS_URL}"]`), 'the figure links its source').toHaveCount(
      1,
    )
  })

  test('Panel is keyboard operable and does not interrupt the simulation', async ({ page }) => {
    await openSimulator(page)
    await startAndRunFor(page, SECONDS_BEFORE_EXPANDING)

    await tabTo(page, researchToggle(page))
    await page.keyboard.press('Enter')

    await expect(researchPanel(page)).toHaveAttribute('open', '')
    await expect(page.getByText('Running', { exact: true })).toBeVisible()
    await advanceSeconds(
      page,
      SECONDS_AFTER_EXPANDING,
      SECONDS_BEFORE_EXPANDING + SECONDS_AFTER_EXPANDING,
    )
  })

  test.describe('on a phone', () => {
    test.use({ viewport: PHONE })

    test('Panel fits a phone', async ({ page }) => {
      await openSimulator(page)

      await openResearchPanel(page)

      await expectNoHorizontalScroll(page)
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
