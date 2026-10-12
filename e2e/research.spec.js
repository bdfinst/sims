import {
  MIN_TEXT_CONTRAST,
  NARROWEST_PHONE,
  PHONE,
  UNSUPPORTED_WORDING,
  runFor,
  contrastRatio,
  escapeRegExp,
  expect,
  expectNoHorizontalScroll,
  expectViewport,
  openResearchPanel,
  openSimulator,
  researchPanel,
  researchToggle,
  sourceLink,
  startSimulation,
  tabTo,
  test,
  textColors,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

// The two phrases the Slice 7 scenario promises for the practitioner observation.
const PRACTITIONER_PHRASES = ['practitioner observation', 'locally coherent but globally brittle']

// Independent oracles (see fixtures.js): the spec's Research Sources table and the Slice 7
// scenarios, not src/research.js. `shown` is what the panel shows for the finding: the spec's
// "Panel wording" verbatim, or the scenario's phrases for the practitioner observation. `title` is
// the source's title as the spec's Source column quotes it; the link is named by it.
const SOURCES = [
  {
    shown: ['2,500 reviews of 3.2 million lines of code over 10 months'],
    title: 'Cisco Systems / Collaborator',
    url: 'https://smartbear.com/resources/case-studies/cisco-systems-collaborator/',
  },
  {
    shown: [
      'Review no more than 200–400 LOC at a time; beyond 400 LOC the ability to find defects diminishes. 200–400 LOC over 60–90 minutes yields 70–90% defect discovery. Defect discovery drops significantly faster than 500 LOC/hour.',
    ],
    title: 'Best Practices for Code Review',
    url: 'https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/',
  },
  {
    shown: [
      'Across 22,000 developers in 4,000 teams, high AI adoption saw PR size +51%, PR merge rate +16.2%, and 3× incidents per PR (+242.7%), compared with low adoption.',
    ],
    title: 'AI Engineering Report Q2 2026: The Acceleration Whiplash',
    url: 'https://faros.ai/research/ai-acceleration-whiplash',
  },
  {
    shown: [
      'AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up (8.1M+ PRs, 4,800+ orgs).',
    ],
    title: '2026 Software Engineering Benchmarks Report',
    url: 'https://linearb.io/blog/engineering-benchmarks-report',
  },
  {
    shown: PRACTITIONER_PHRASES,
    title: 'The AI Code Review Inversion',
    url: 'https://tianpan.co/blog/2026-05-07-ai-code-review-inversion-reviewing-machine-authored-code',
  },
]
const NEW_TAB_NOTICE = ' (opens in new tab)'
const ASSUMPTIONS_START = 'Model assumptions'
const CALIBRATION_SENTENCE =
  "The human defaults were chosen to land near Faros's +242.7% incidents per PR"
// The plan's Page behavior: the calibration figure is the link "Faros's +242.7% incidents per PR".
const CALIBRATION_LINK_TEXT = "Faros's +242.7% incidents per PR"
const FAROS_URL = SOURCES[2].url
const SMARTBEAR_PRACTICES_URL = SOURCES[1].url
// The plan's Page behavior: two more phrases in the note link their sources.
const SMARTBEAR_RANGE_LINK_TEXT = "SmartBear's 70–90%"
const FAROS_MULTIPLIERS_LINK_TEXT = 'come from Faros'
const NOTE_LINK_COUNT = 3
const SECONDS_AFTER_EXPANDING = 1

const assumptionsParagraph = (page) =>
  researchPanel(page).locator('p', { hasText: ASSUMPTIONS_START })

// A link in the assumptions note, found by its visible text.
const noteLink = (page, text) => assumptionsParagraph(page).locator('a', { hasText: text })

const expectPanelContains = (page, text) => expect(researchPanel(page)).toContainText(text)

// The source's finding is visible in the panel.
const expectFindingShown = async (page, { shown, url }) => {
  for (const text of shown) await expect(researchPanel(page).getByText(text), url).toBeVisible()
}

// The link opens in a new tab, protects the opener, and its accessible name contains `name` and
// ends with the new-tab notice.
const expectNewTabLink = async (link, { name, url }) => {
  await expect(link, `${url} opens in a new tab`).toHaveAttribute('target', '_blank')
  await expect(link, `${url} protects the opener`).toHaveAttribute('rel', /noopener/)
  await expect(link, `${url} is named by ${name}`).toHaveAccessibleName(
    new RegExp(`${escapeRegExp(name)}.*${escapeRegExp(NEW_TAB_NOTICE)}$`),
  )
}

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
        ...SOURCES.flatMap(({ shown }) => shown.map((text) => researchPanel(page).getByText(text))),
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
      await expectFindingShown(page, SOURCES[0])
    })

    await test.step('And the panel contains "Review no more than 200–400 LOC at a time"', async () => {
      await expectFindingShown(page, SOURCES[1])
    })

    await test.step('And the panel contains "faster than 500 LOC/hour"', async () => {
      await expectPanelContains(page, 'faster than 500 LOC/hour')
    })

    await test.step('And the panel contains "high AI adoption saw PR size +51%, PR merge rate +16.2%, and 3× incidents per PR (+242.7%)"', async () => {
      await expectFindingShown(page, SOURCES[2])
    })

    await test.step('And the panel contains "AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up"', async () => {
      await expectFindingShown(page, SOURCES[3])
    })

    await test.step('And the panel contains "practitioner observation" and "locally coherent but globally brittle"', async () => {
      await expectFindingShown(page, SOURCES[4])
    })

    await test.step("And the panel links to all five source URLs from the spec's Research Sources table, each opening in a new tab", async () => {
      for (const { title, url } of SOURCES) {
        const link = sourceLink(page, url)
        await expect(link, url).toHaveCount(1)
        await expectNewTabLink(link, { name: title, url })
      }
    })
  })

  // No scenario of its own: the plan's accessibility rule (WCAG 1.4.3) applied to the panel's links.
  test('Links have sufficient contrast', async ({ page }) => {
    await openSimulator(page)
    await openResearchPanel(page)

    const links = [
      ...SOURCES.map(({ url }) => ({ link: sourceLink(page, url), name: url })),
      { link: noteLink(page, SMARTBEAR_RANGE_LINK_TEXT), name: 'SmartBear range link' },
      { link: noteLink(page, FAROS_MULTIPLIERS_LINK_TEXT), name: 'Faros multipliers link' },
      { link: noteLink(page, CALIBRATION_LINK_TEXT), name: 'calibration link' },
    ]
    for (const { link, name } of links) {
      const ratio = contrastRatio(await textColors(link))
      expect(ratio, name).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
    }
  })

  test('Unsupported or misattributing wording never appears', async ({ page }) => {
    await test.step('Given I expand "Research behind this simulation"', async () => {
      await openSimulator(page)
      await openResearchPanel(page)
    })

    await test.step('Then the page does not contain "near zero", "coined", or "originated"', async () => {
      const pageText = (await page.locator('body').innerText()).toLowerCase()
      for (const phrase of UNSUPPORTED_WORDING) {
        expect(pageText, `page text contains "${phrase}"`).not.toContain(phrase)
      }
    })
  })

  test('Model assumptions and calibration are stated', async ({ page }) => {
    await test.step('Given I expand "Research behind this simulation"', async () => {
      await openSimulator(page)
      await openResearchPanel(page)
    })

    await test.step('Then the panel contains "These are modeling choices, not research findings"', async () => {
      await expectPanelContains(page, 'These are modeling choices, not research findings')
    })

    await test.step('And the panel contains "the defect density (20 defects per 1,000 LOC)"', async () => {
      await expectPanelContains(page, 'the defect density (20 defects per 1,000 LOC)')
    })

    await test.step('And the panel contains "the base detection rate (0.8, picked from SmartBear\'s 70–90% range)"', async () => {
      await expectPanelContains(
        page,
        "the base detection rate (0.8, picked from SmartBear's 70–90% range)",
      )
      const link = noteLink(page, SMARTBEAR_RANGE_LINK_TEXT)
      await expect(link, 'the range links its source').toHaveAttribute(
        'href',
        SMARTBEAR_PRACTICES_URL,
      )
      await expectNewTabLink(link, {
        name: SMARTBEAR_RANGE_LINK_TEXT,
        url: SMARTBEAR_PRACTICES_URL,
      })
    })

    await test.step('And the panel contains "the detection floors (0.05 for large PRs and 0.1 for fast reviewing)"', async () => {
      await expectPanelContains(
        page,
        'the detection floors (0.05 for large PRs and 0.1 for fast reviewing)',
      )
    })

    await test.step('And the panel contains "the curve thresholds (PR size 200 to 400 LOC, reviewer speed 500 to 1,000 LOC/hr)"', async () => {
      await expectPanelContains(
        page,
        'the curve thresholds (PR size 200 to 400 LOC, reviewer speed 500 to 1,000 LOC/hr)',
      )
    })

    await test.step('And the panel contains "the human-lane defaults, an assumption (30 LOC/hr and 1 PR per day)"', async () => {
      await expectPanelContains(
        page,
        'the human-lane defaults, an assumption (30 LOC/hr and 1 PR per day)',
      )
    })

    await test.step('And the panel contains "The AI lane\'s PR size (1.51× the human PR size) and default volume (giving 1.17× the human PRs per day) come from Faros"', async () => {
      await expectPanelContains(
        page,
        "The AI lane's PR size (1.51× the human PR size) and default volume (giving 1.17× the human PRs per day) come from Faros",
      )
      const link = noteLink(page, FAROS_MULTIPLIERS_LINK_TEXT)
      await expect(link, 'the multipliers link their source').toHaveAttribute('href', FAROS_URL)
      await expectNewTabLink(link, { name: FAROS_MULTIPLIERS_LINK_TEXT, url: FAROS_URL })
    })

    await test.step('And the panel contains "The human defaults were chosen to land near Faros\'s +242.7% incidents per PR"', async () => {
      await expectPanelContains(page, CALIBRATION_SENTENCE)
      await expect(assumptionsParagraph(page).locator('a'), 'links in the note').toHaveCount(
        NOTE_LINK_COUNT,
      )
      const link = noteLink(page, CALIBRATION_LINK_TEXT)
      await expect(link, 'the figure links its source').toHaveAttribute('href', FAROS_URL)
      await expectNewTabLink(link, { name: CALIBRATION_LINK_TEXT, url: FAROS_URL })
    })
  })

  test('Panel is keyboard operable and does not interrupt the simulation', async ({ page }) => {
    await test.step('Given the simulation is running', async () => {
      await openSimulator(page)
      await startSimulation(page)
    })

    await test.step('When I Tab to the research toggle and press Enter', async () => {
      await tabTo(page, researchToggle(page))
      await page.keyboard.press('Enter')
    })

    await test.step('Then the panel expands and the status still reads "Running"', async () => {
      await expect(researchPanel(page)).toHaveAttribute('open', '')
      // "Still" running: time keeps advancing the elapsed readout after the panel opens.
      await runFor(page, SECONDS_AFTER_EXPANDING)
      await expect(page.getByText('Running', { exact: true })).toBeVisible()
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
