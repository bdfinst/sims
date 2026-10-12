import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from './fixtures.js'

const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url))
const FIXED_START_MS = Date.parse('2026-01-05T09:00:00Z')
const CLOCK_PAUSE_OFFSET_MS = 60_000
const SECOND_MS = 1000
const TITLE = 'AI vs. Human Code Review Simulator'
const DESCRIPTION =
  'Watch AI-speed code generation swamp human reviewers and push more defects into production.'
const HUMAN_BLUE = 'rgb(59, 130, 246)'
const AI_PURPLE = 'rgb(168, 85, 247)'
const LANE_IDS = ['human', 'ai']

const openSimulator = async (page) => {
  await page.clock.install({ time: FIXED_START_MS })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: TITLE })).toBeVisible()
  await page.clock.pauseAt(FIXED_START_MS + CLOCK_PAUSE_OFFSET_MS)
}

const lane = (page, id) => page.locator(`[data-lane="${id}"]`)
const metric = (page, laneId, name) => lane(page, laneId).locator(`[data-metric="${name}"]`)
const iconNames = (laneLocator) =>
  laneLocator.locator('[data-icon]').evaluateAll((els) => els.map((el) => el.dataset.icon))

const expectEmptyLanes = async (page) => {
  for (const laneId of LANE_IDS) {
    await expect(metric(page, laneId, 'pending')).toHaveText('0')
    await expect(metric(page, laneId, 'deployed')).toHaveText('0')
  }
}

test.describe('Run and pause the simulation', () => {
  test('Page loads paused with empty lanes', async ({ page }) => {
    await openSimulator(page)

    await expectEmptyLanes(page)
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible()
    await expect(page.getByText('Paused', { exact: true })).toBeVisible()
    await expect(page.getByText('0.0 work hours', { exact: true })).toBeVisible()
    await expect(page.getByText('1 s = 1 work hour', { exact: true })).toBeVisible()
  })

  test('Headline shows no ratio before any PR is deployed', async ({ page }) => {
    await openSimulator(page)

    await expect(page.locator('[data-metric="headline-ratio"]')).toHaveText('—')
  })

  test('Header content', async ({ page }) => {
    await openSimulator(page)

    const header = page.getByRole('banner')
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(TITLE)
    await expect(header.getByText(DESCRIPTION, { exact: true })).toBeVisible()
    await expect(header).toMatchAriaSnapshot(`
      - heading "${TITLE}" [level=1]
      - paragraph: ${DESCRIPTION}
      - button "Start"
      - button "Reset"
    `)
  })

  test('Start and Reset have a visible gap between them', async ({ page }) => {
    await openSimulator(page)

    const start = await page.getByRole('button', { name: 'Start' }).boundingBox()
    const reset = await page.getByRole('button', { name: 'Reset' }).boundingBox()
    const minimumGapPx = 8
    expect(reset.x - (start.x + start.width)).toBeGreaterThanOrEqual(minimumGapPx)
  })

  test('Lane identity', async ({ page }) => {
    await openSimulator(page)

    expect(await iconNames(lane(page, 'human'))).toEqual(['user', 'eye'])
    expect(await iconNames(lane(page, 'ai'))).toEqual(['bot', 'eye'])
    await expect(lane(page, 'human')).toHaveCSS('border-top-color', HUMAN_BLUE)
    await expect(lane(page, 'ai')).toHaveCSS('border-top-color', AI_PURPLE)
  })

  test('Nothing moves while paused', async ({ page }) => {
    await openSimulator(page)

    await page.clock.runFor(5 * SECOND_MS)

    await expectEmptyLanes(page)
    await expect(page.getByText('0.0 work hours', { exact: true })).toBeVisible()
  })

  test('The build is one self-contained file', async ({ page }) => {
    const html = readFileSync(`${DIST_DIR}index.html`, 'utf8')

    const found = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, 'text/html')
      const count = (selector) => doc.querySelectorAll(selector).length
      const fileIconLinks = [...doc.querySelectorAll('link[rel~="icon"][href]')].filter(
        (link) => !link.getAttribute('href').startsWith('data:'),
      )
      return {
        scriptsWithSrc: count('script[src]'),
        stylesheets: count('link[rel~="stylesheet"]'),
        modulePreloads: count('link[rel~="modulepreload"]'),
        fileIconLinks: fileIconLinks.length,
        inlineScripts: count('script:not([src])'),
        inlineStyles: count('style'),
      }
    }, html)

    expect(found).toMatchObject({
      scriptsWithSrc: 0,
      stylesheets: 0,
      modulePreloads: 0,
      fileIconLinks: 0,
    })
    expect(found.inlineScripts).toBeGreaterThan(0)
    expect(found.inlineStyles).toBeGreaterThan(0)
    const otherAssets = readdirSync(DIST_DIR, { recursive: true }).filter((file) =>
      /\.(m?js|css)$/.test(file),
    )
    expect(otherAssets).toEqual([])
  })
})
