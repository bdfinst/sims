import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  INLINE_PROTOCOLS,
  REFERENCE,
  SECOND_MS,
  SIMULATOR_TITLE as TITLE,
  TICKS_PER_SECOND,
  expect,
  expectCounts,
  expectElapsedAtTick,
  expectEmptyLanes,
  laneLocator,
  metric,
  metricValues,
  openSimulator,
  pauseSimulation,
  sampleEachTick,
  startSimulation,
  test,
  buttonNamed,
} from './fixtures.js'

const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url))
const DESCRIPTION =
  'Watch AI-speed code generation swamp human reviewers and push more defects into production.'
const HUMAN_BLUE = 'rgb(59, 130, 246)'
const AI_PURPLE = 'rgb(168, 85, 247)'

const iconNames = (laneRoot) =>
  laneRoot.locator('[data-icon]').evaluateAll((els) => els.map((el) => el.dataset.icon))

const setVisibility = (page, visibilityState) =>
  page.evaluate((state) => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }, visibilityState)

test.describe('Run and pause the simulation', () => {
  test('Page loads paused with empty lanes', async ({ page }) => {
    await openSimulator(page)

    await expectEmptyLanes(page)
    await expect(buttonNamed(page, 'Start')).toBeVisible()
    await expect(page.getByText('Paused', { exact: true })).toBeVisible()
    await expectElapsedAtTick(page, 0)
    await expect(page.getByText('1 s = 1 work hour', { exact: true })).toBeVisible()
  })

  test('Headline shows no ratio before any PR is deployed', async ({ page }) => {
    await openSimulator(page)

    await expect(page.locator('[data-metric="headlineRatio"]')).toHaveText('—')
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

    const startBox = await buttonNamed(page, 'Start').boundingBox()
    const resetBox = await buttonNamed(page, 'Reset').boundingBox()
    const minimumGapPx = 8
    expect(resetBox.x - (startBox.x + startBox.width)).toBeGreaterThanOrEqual(minimumGapPx)
  })

  test('Lane identity', async ({ page }) => {
    await openSimulator(page)

    expect(await iconNames(laneLocator(page, 'human'))).toEqual(['user', 'eye'])
    expect(await iconNames(laneLocator(page, 'ai'))).toEqual(['bot', 'eye'])
    await expect(laneLocator(page, 'human')).toHaveCSS('border-top-color', HUMAN_BLUE)
    await expect(laneLocator(page, 'ai')).toHaveCSS('border-top-color', AI_PURPLE)
  })

  test('Nothing moves while paused', async ({ page }) => {
    await openSimulator(page)

    await page.clock.runFor(5 * SECOND_MS)

    await expectEmptyLanes(page)
    await expectElapsedAtTick(page, 0)
  })

  test('Start switches the button to Pause', async ({ page }) => {
    await openSimulator(page)

    await buttonNamed(page, 'Start').click()

    await expect(buttonNamed(page, 'Pause')).toBeVisible()
    await expect(page.getByText('Running', { exact: true })).toBeVisible()
  })

  test('Default flow after 10 seconds', async ({ page }) => {
    await openSimulator(page)

    await startSimulation(page)
    await page.clock.runFor(10 * SECOND_MS)

    await expectCounts(page, 'human', { pending: 0, deployed: REFERENCE.humanDeployedAtTick100 })
    await expectCounts(page, 'ai', {
      pending: REFERENCE.aiPendingAtTick100,
      deployed: REFERENCE.aiDeployedAtTick100,
    })
    await expectElapsedAtTick(page, 10 * TICKS_PER_SECOND)
  })

  test('A PR is not shown as deployed until it is fully reviewed', async ({ page }) => {
    await openSimulator(page)

    await startSimulation(page)
    await page.clock.runFor(0.9 * SECOND_MS)
    await expect(metric(page, 'human', 'deployed')).toHaveText('0')

    await page.clock.runFor(0.1 * SECOND_MS)
    await expect(metric(page, 'human', 'deployed')).toHaveText('1')
  })

  test('Pause freezes the counts', async ({ page }) => {
    await openSimulator(page)
    await startSimulation(page)
    await page.clock.runFor(3 * SECOND_MS)

    await pauseSimulation(page)
    await page.clock.runFor(5 * SECOND_MS)

    await expectCounts(page, 'ai', {
      pending: REFERENCE.aiPendingAtTick30,
      deployed: REFERENCE.aiDeployedAtTick30,
    })
    await expectElapsedAtTick(page, 3 * TICKS_PER_SECOND)
  })

  test('Resume continues from the frozen counts', async ({ page }) => {
    await openSimulator(page)
    await startSimulation(page)
    await page.clock.runFor(3 * SECOND_MS)
    await pauseSimulation(page)

    await startSimulation(page)
    await page.clock.runFor(1 * SECOND_MS)

    await expectCounts(page, 'ai', {
      pending: REFERENCE.aiPendingAtTick40,
      deployed: REFERENCE.aiDeployedAtTick40,
    })
  })

  test('Deployed never decreases while running', async ({ page }) => {
    await openSimulator(page)
    await startSimulation(page)
    const readDeployed = () => metricValues(page, 'deployed')

    const samples = [
      await readDeployed(),
      ...(await sampleEachTick(page, {
        startTick: 0,
        tickCount: 10 * TICKS_PER_SECOND,
        read: readDeployed,
      })),
    ]

    const decreases = samples
      .slice(1)
      .filter((current, sampleIndex) =>
        Object.entries(current).some(([laneId, count]) => count < samples[sampleIndex][laneId]),
      )
    expect(decreases).toEqual([])
    await expect.poll(readDeployed).toEqual({
      human: REFERENCE.humanDeployedAtTick100,
      ai: REFERENCE.aiDeployedAtTick100,
    })
  })

  test('Hiding the tab auto-pauses', async ({ page }) => {
    await openSimulator(page)
    await startSimulation(page)
    await page.clock.runFor(1 * SECOND_MS)

    await setVisibility(page, 'hidden')
    await expect(buttonNamed(page, 'Start')).toBeVisible()
    await page.clock.runFor(3 * SECOND_MS)

    await expect(page.getByText('Paused', { exact: true })).toBeVisible()
    await expect(metric(page, 'ai', 'pending')).toHaveText(String(REFERENCE.aiPendingAtTick10))
  })

  test('Showing the tab again stays paused', async ({ page }) => {
    await openSimulator(page)
    await startSimulation(page)
    await page.clock.runFor(1 * SECOND_MS)
    await setVisibility(page, 'hidden')
    await expect(buttonNamed(page, 'Start')).toBeVisible()

    await setVisibility(page, 'visible')
    await page.clock.runFor(2 * SECOND_MS)

    await expect(page.getByText('Paused', { exact: true })).toBeVisible()
    await expect(metric(page, 'ai', 'pending')).toHaveText(String(REFERENCE.aiPendingAtTick10))
  })

  test('Hiding the tab while paused changes nothing', async ({ page }) => {
    await openSimulator(page)

    await setVisibility(page, 'hidden')

    await expect(page.getByText('Paused', { exact: true })).toBeVisible()
    await expectEmptyLanes(page)
  })

  test('The built file runs from disk with no other requests', async ({ page }) => {
    const documentUrl = pathToFileURL(`${DIST_DIR}index.html`).href
    const requestedUrls = []
    page.on('request', (request) => requestedUrls.push(request.url()))
    await openSimulator(page, documentUrl)

    await startSimulation(page)
    await page.clock.runFor(1 * SECOND_MS)

    await expect(metric(page, 'ai', 'pending')).toHaveText(String(REFERENCE.aiPendingAtTick10))
    const nonInlineRequests = requestedUrls.filter(
      (url) => !INLINE_PROTOCOLS.has(new URL(url).protocol),
    )
    expect(nonInlineRequests).toEqual([documentUrl])
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
