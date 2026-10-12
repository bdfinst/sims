import {
  RESEARCH_TITLE,
  advanceSeconds,
  contrastRatio,
  expect,
  expectNoHorizontalScroll,
  openSimulator,
  researchPanel,
  researchToggle,
  startAndRunFor,
  tabTo,
  test,
  textColors,
} from './fixtures.js'

test.describe.configure({ mode: 'parallel' })

// The spec's Research Sources "Panel wording" column, as literals (independent of src/research.js).
const FINDING_PHRASES = [
  '2,500 reviews of 3.2 million lines of code over 10 months',
  'Review no more than 200–400 LOC at a time',
  'faster than 500 LOC/hour',
  'PR size +51%',
  '(+242.7%)',
  'AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up',
  'practitioner observation',
  'locally coherent but globally brittle',
]
const SOURCE_URLS = [
  'https://smartbear.com/resources/case-studies/cisco-systems-collaborator/',
  'https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/',
  'https://faros.ai/research/ai-acceleration-whiplash',
  'https://linearb.io/blog/engineering-benchmarks-report',
  'https://tianpan.co/blog/2026-05-07-ai-code-review-inversion-reviewing-machine-authored-code',
]
const FORBIDDEN_PHRASES = ['near zero', 'coined', 'originated']
const ASSUMPTION_PHRASES = [
  'modeling choices',
  'defect density',
  'detection floors',
  'curve knees and walls',
  '1.51 size multiplier',
]
const CALIBRATION_PHRASE = "calibrated so the AI lane lands near Faros's +242.7% incidents per PR"
const MIN_TEXT_CONTRAST = 4.5 // WCAG 1.4.3
const PHONE = { width: 375, height: 667 }
const SECONDS_BEFORE_EXPANDING = 1
const SECONDS_AFTER_EXPANDING = 1

const expand = (page) => researchToggle(page).click()

test.describe('Research behind the simulation', () => {
  test('Panel is collapsed by default', async ({ page }) => {
    await openSimulator(page)

    await expect(researchToggle(page)).toBeVisible()
    await expect(researchPanel(page)).not.toHaveAttribute('open')
    await expect(page.getByText(FINDING_PHRASES[0])).toBeHidden()
  })

  test('Expanding shows every finding verbatim with its source', async ({ page }) => {
    await openSimulator(page)

    await expand(page)

    for (const phrase of FINDING_PHRASES) {
      await expect(researchPanel(page)).toContainText(phrase)
    }
  })

  test('The panel links to all five sources, each opening in a new tab', async ({ page }) => {
    await openSimulator(page)
    await expand(page)

    for (const url of SOURCE_URLS) {
      const link = researchPanel(page).locator(`a[href="${url}"]`)
      await expect(link, url).toHaveCount(1)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /noopener/)
    }
  })

  test('Links read as their source, not as "click here"', async ({ page }) => {
    await openSimulator(page)
    await expand(page)

    const names = await researchPanel(page).getByRole('link').allTextContents()
    expect(names).toHaveLength(SOURCE_URLS.length)
    for (const name of names) expect(name).not.toMatch(/click here|here$/i)
  })

  test('Links have sufficient contrast', async ({ page }) => {
    await openSimulator(page)
    await expand(page)

    for (const url of SOURCE_URLS) {
      const ratio = contrastRatio(await textColors(researchPanel(page).locator(`a[href="${url}"]`)))
      expect(ratio, url).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
    }
  })

  test('Unsupported or misattributing wording never appears', async ({ page }) => {
    await openSimulator(page)
    await expand(page)

    const pageText = (await page.locator('body').innerText()).toLowerCase()
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(pageText, `page text contains "${phrase}"`).not.toContain(phrase)
    }
  })

  test('Model assumptions and calibration are stated', async ({ page }) => {
    await openSimulator(page)
    await expand(page)

    for (const phrase of ASSUMPTION_PHRASES) {
      await expect(researchPanel(page)).toContainText(phrase)
    }
    await expect(researchPanel(page)).toContainText(CALIBRATION_PHRASE)
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

      await expand(page)

      await expect(researchPanel(page)).toHaveAttribute('open', '')
      await expectNoHorizontalScroll(page)
    })
  })

  test('The toggle is named by its title', async ({ page }) => {
    await openSimulator(page)

    await expect(researchToggle(page)).toHaveText(RESEARCH_TITLE)
  })
})
