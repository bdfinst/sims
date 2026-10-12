import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  BUSY_AI_PRESET,
  INLINE_PROTOCOLS,
  NO_VALUE,
  REFERENCE,
  SECOND_MS,
  SIMULATOR_TITLE as TITLE,
  TICKS_PER_SECOND,
  expect,
  expectCounts,
  expectDeployed,
  expectElapsedAtTick,
  expectEmptyLanes,
  expectNeverDecreases,
  flushPendingRenders,
  headline,
  laneLocator,
  metricValues,
  openWithSliders,
  openSimulator,
  expectPending,
  pauseSimulation,
  runFor,
  sampleEachTick,
  setSliders,
  startAndRunFor,
  startSimulation,
  test,
  buttonNamed,
  FULL_RUN_SECONDS,
  expectLiveIntervals,
} from './fixtures.js'

const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url))
const DESCRIPTION =
  'Watch AI-speed code generation swamp human reviewers and push more defects into production.'
const HUMAN_BLUE = 'rgb(59, 130, 246)'
const AI_PURPLE = 'rgb(168, 85, 247)'

const PAUSE_AFTER_SECONDS = 3
const LAST_TICK_BEFORE_FIRST_HUMAN_PR_SECONDS = 7.9
const ONE_TICK_SECONDS = 0.1

const iconNames = (laneRoot) =>
  laneRoot.locator('[data-icon]').evaluateAll((els) => els.map((el) => el.dataset.icon))

const setVisibility = (page, visibilityState) =>
  page.evaluate((state) => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }, visibilityState)

test.describe.configure({ mode: 'parallel' })

test.describe('Run and pause the simulation', () => {
  test('Page loads paused with empty lanes', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('Then both lanes show Pending Review 0 and Deployed 0', async () => {
      await expectEmptyLanes(page)
    })

    await test.step('And the Start/Pause button reads "Start"', async () => {
      await expect(buttonNamed(page, 'Start')).toBeVisible()
    })

    await test.step('And the status reads "Paused"', async () => {
      await expect(page.getByText('Paused', { exact: true })).toBeVisible()
    })

    await test.step('And the elapsed readout shows "0.0 work hours" with the caption "1 s = 1 work hour"', async () => {
      await expectElapsedAtTick(page, 0)
      await expect(page.getByText('1 s = 1 work hour', { exact: true })).toBeVisible()
    })
  })

  test('Headline shows no ratio before any PR is deployed', async ({ page }) => {
    await openSimulator(page)

    await expect(headline(page)).toHaveText(NO_VALUE)
  })

  test('Header content', async ({ page }) => {
    const header = page.getByRole('banner')

    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('Then the header shows the title "AI vs. Human Code Review Simulator"', async () => {
      await expect(header.getByRole('heading', { level: 1 })).toHaveText(TITLE)
    })

    await test.step('And the header shows "Watch AI-speed code generation swamp human reviewers and push more defects into production."', async () => {
      await expect(header.getByText(DESCRIPTION, { exact: true })).toBeVisible()
    })

    await test.step('And the Start/Pause and Reset buttons follow the title in reading order', async () => {
      await expect(header).toMatchAriaSnapshot(`
      - heading "${TITLE}" [level=1]
      - paragraph: ${DESCRIPTION}
      - button "Start"
      - button "Reset"
    `)
    })
  })

  test('Start and Reset have a visible gap between them', async ({ page }) => {
    await openSimulator(page)

    const startBox = await buttonNamed(page, 'Start').boundingBox()
    const resetBox = await buttonNamed(page, 'Reset').boundingBox()
    const minimumGapPx = 8
    expect(resetBox.x - (startBox.x + startBox.width)).toBeGreaterThanOrEqual(minimumGapPx)
  })

  test('Lane identity', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('Then the Human lane has a "user" icon at generation, an "eye" icon at review, and a blue accent', async () => {
      expect(await iconNames(laneLocator(page, 'human'))).toEqual(['user', 'eye'])
      await expect(laneLocator(page, 'human')).toHaveCSS('border-top-color', HUMAN_BLUE)
    })

    await test.step('And the AI lane has a "bot" icon at generation, an "eye" icon at review, and a purple accent', async () => {
      expect(await iconNames(laneLocator(page, 'ai'))).toEqual(['bot', 'eye'])
      await expect(laneLocator(page, 'ai')).toHaveCSS('border-top-color', AI_PURPLE)
    })
  })

  test('Nothing moves while paused', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When 5 seconds pass without pressing Start', async () => {
      await page.clock.runFor(5 * SECOND_MS)
    })

    await test.step('Then both lanes still show Pending Review 0 and Deployed 0', async () => {
      await expectEmptyLanes(page)
    })

    await test.step('And the elapsed readout shows "0.0 work hours"', async () => {
      await expectElapsedAtTick(page, 0)
    })
  })

  test('Start switches the button to Pause', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
      await expectLiveIntervals(page, 0)
    })

    await test.step('When I press Start', async () => {
      await buttonNamed(page, 'Start').click()
    })

    await test.step('Then the Start/Pause button reads "Pause" and the status reads "Running"', async () => {
      await expect(buttonNamed(page, 'Pause')).toBeVisible()
      await expect(page.getByText('Running', { exact: true })).toBeVisible()
      // Plan, Step 1.2 REFACTOR: exactly one tick interval while running.
      await expectLiveIntervals(page, 1)
    })
  })

  test('Default flow after 10 seconds', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I press Start and 10 seconds pass', async () => {
      await startAndRunFor(page, FULL_RUN_SECONDS)
    })

    await test.step('Then the Human lane shows Pending Review 0 and Deployed 1', async () => {
      await expectCounts(page, 'human', {
        pending: REFERENCE.defaultHumanPendingAtTick100,
        deployed: REFERENCE.defaultHumanDeployedAtTick100,
      })
    })

    await test.step('And the AI lane shows Pending Review 0 and Deployed 1', async () => {
      await expectCounts(page, 'ai', {
        pending: REFERENCE.defaultAiPendingAtTick100,
        deployed: REFERENCE.defaultAiDeployedAtTick100,
      })
    })

    await test.step('And the elapsed readout shows "10.0 work hours"', async () => {
      await expectElapsedAtTick(page, FULL_RUN_SECONDS * TICKS_PER_SECOND)
    })
  })

  test('A PR is not shown as deployed until it is fully reviewed', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When I press Start and 7.9 seconds pass', async () => {
      await startAndRunFor(page, LAST_TICK_BEFORE_FIRST_HUMAN_PR_SECONDS)
    })

    await test.step('Then the Human lane shows Deployed 0', async () => {
      await expectDeployed(page, 'human', REFERENCE.defaultHumanDeployedAtTick79)
    })

    await test.step('When 0.1 more seconds pass', async () => {
      await runFor(page, ONE_TICK_SECONDS)
    })

    await test.step('Then the Human lane shows Deployed 1', async () => {
      await expectDeployed(page, 'human', REFERENCE.defaultHumanDeployedAtTick80)
    })
  })

  test('Pause freezes the counts', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 3 seconds', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, PAUSE_AFTER_SECONDS)
    })

    await test.step('When I press Pause and 5 more seconds pass', async () => {
      await pauseSimulation(page)
      await page.clock.runFor(5 * SECOND_MS)
      await flushPendingRenders(page)
      // Plan, Step 1.2 REFACTOR: clear the interval on pause.
      await expectLiveIntervals(page, 0)
    })

    await test.step('Then the AI lane shows Pending Review 11 and Deployed 4', async () => {
      await expectCounts(page, 'ai', {
        pending: REFERENCE.busyAiPendingAtTick30,
        deployed: REFERENCE.busyAiDeployedAtTick30,
      })
    })

    await test.step('And the elapsed readout shows "3.0 work hours"', async () => {
      await expectElapsedAtTick(page, PAUSE_AFTER_SECONDS * TICKS_PER_SECOND)
    })

    await test.step('And the Start/Pause button reads "Start"', async () => {
      await expect(buttonNamed(page, 'Start')).toBeVisible()
    })
  })

  test('Resume continues from the frozen counts', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation was paused after 3 seconds', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, PAUSE_AFTER_SECONDS)
      await pauseSimulation(page)
    })

    await test.step('When I press Start and 1 second passes', async () => {
      await startAndRunFor(page, 1)
    })

    await test.step('Then the AI lane shows Pending Review 15 and Deployed 6', async () => {
      await expectCounts(page, 'ai', {
        pending: REFERENCE.busyAiPendingAtTick40,
        deployed: REFERENCE.busyAiDeployedAtTick40,
      })
    })
  })

  test('Deployed never decreases while running', async ({ page }) => {
    const readDeployed = () => metricValues(page, 'deployed')

    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and press Start', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startSimulation(page)
    })

    await test.step("Then each lane's Deployed count, sampled every tick for 10 seconds, never decreases", async () => {
      const samples = [
        await readDeployed(),
        ...(await sampleEachTick(page, {
          startTick: 0,
          tickCount: FULL_RUN_SECONDS * TICKS_PER_SECOND,
          read: readDeployed,
        })),
      ]

      expectNeverDecreases(samples)
      await expect.poll(readDeployed).toEqual({
        human: REFERENCE.defaultHumanDeployedAtTick100,
        ai: REFERENCE.busyAiDeployedAtTick100,
      })
    })
  })

  test('Hiding the tab auto-pauses', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 1 second', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, 1)
    })

    await test.step('When the page becomes hidden', async () => {
      await setVisibility(page, 'hidden')
      await expect(buttonNamed(page, 'Start')).toBeVisible()
    })

    await test.step('And 3 seconds pass', async () => {
      await page.clock.runFor(3 * SECOND_MS)
      await flushPendingRenders(page)
    })

    await test.step('Then the status reads "Paused" and the AI lane still shows Pending Review 3', async () => {
      await expect(page.getByText('Paused', { exact: true })).toBeVisible()
      await expectPending(page, 'ai', REFERENCE.busyAiPendingAtTick10)
      // Plan, Step 1.2 REFACTOR: clear the interval when the tab is hidden.
      await expectLiveIntervals(page, 0)
    })
  })

  test('Showing the tab again stays paused', async ({ page }) => {
    await test.step('Given I set "AI code written (LOC/hr)" to 2000 and the simulation auto-paused when the page became hidden after 1 second', async () => {
      await openWithSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, 1)
      await setVisibility(page, 'hidden')
      await expect(buttonNamed(page, 'Start')).toBeVisible()
    })

    await test.step('When the page becomes visible again', async () => {
      await setVisibility(page, 'visible')
    })

    await test.step('And 2 seconds pass', async () => {
      await page.clock.runFor(2 * SECOND_MS)
      await flushPendingRenders(page)
    })

    await test.step('Then the status reads "Paused" and the AI lane still shows Pending Review 3', async () => {
      await expect(page.getByText('Paused', { exact: true })).toBeVisible()
      await expectPending(page, 'ai', REFERENCE.busyAiPendingAtTick10)
    })
  })

  test('Hiding the tab while paused changes nothing', async ({ page }) => {
    await test.step('Given I open the simulator', async () => {
      await openSimulator(page)
    })

    await test.step('When the page becomes hidden', async () => {
      await setVisibility(page, 'hidden')
    })

    await test.step('Then the status reads "Paused" and all counts show 0', async () => {
      await expect(page.getByText('Paused', { exact: true })).toBeVisible()
      await expectEmptyLanes(page)
    })
  })

  test('The built file runs from disk with no other requests', async ({ page }) => {
    const documentUrl = pathToFileURL(`${DIST_DIR}index.html`).href
    const requestedUrls = []

    await test.step('Given the project is built', async () => {
      expect(existsSync(DIST_DIR), 'dist/ exists').toBe(true)
    })

    await test.step('When I open dist/index.html from the file system', async () => {
      page.on('request', (request) => requestedUrls.push(request.url()))
      await openSimulator(page, documentUrl)
    })

    await test.step('Then the header title is visible', async () => {
      await expect(page.getByRole('heading', { name: TITLE })).toBeVisible()
    })

    await test.step('When I set "AI code written (LOC/hr)" to 2000, press Start, and 1 second passes', async () => {
      await setSliders(page, BUSY_AI_PRESET)
      await startAndRunFor(page, 1)
    })

    await test.step('Then the AI lane shows Pending Review 3', async () => {
      await expectPending(page, 'ai', REFERENCE.busyAiPendingAtTick10)
    })

    await test.step('And the only request made was for the document itself', async () => {
      const nonInlineRequests = requestedUrls.filter(
        (url) => !INLINE_PROTOCOLS.has(new URL(url).protocol),
      )
      expect(nonInlineRequests).toEqual([documentUrl])
    })
  })

  test('The build is one self-contained file', async ({ page }) => {
    let html

    await test.step('Given the project is built', async () => {
      expect(existsSync(DIST_DIR), 'dist/ exists').toBe(true)
    })

    await test.step('Then dist/index.html exists', async () => {
      expect(existsSync(`${DIST_DIR}index.html`), 'dist/index.html exists').toBe(true)
      html = readFileSync(`${DIST_DIR}index.html`, 'utf8')
    })

    await test.step('And it has no script element with a src attribute, no stylesheet link, no modulepreload link, and no icon link to a file', async () => {
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
    })

    await test.step('And dist contains no other JS or CSS files', async () => {
      const otherAssets = readdirSync(DIST_DIR, { recursive: true }).filter((file) =>
        /\.(m?js|css)$/.test(file),
      )
      expect(otherAssets).toEqual([])
    })
  })
})
