import { test as base, expect } from '@playwright/test'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
export const INLINE_PROTOCOLS = new Set(['data:', 'blob:'])
const FILE_PROTOCOL = 'file:'

// The page may only talk to the local server. A file:// page may only load its own
// document (plus inline data:/blob: URIs); the build must be self-contained.
export const isAllowedRequest = ({ url, isMainDocument }) => {
  const { protocol, hostname } = new URL(url)
  if (INLINE_PROTOCOLS.has(protocol)) return true
  if (protocol === FILE_PROTOCOL) return isMainDocument
  return LOCAL_HOSTS.has(hostname)
}

// A popup's first navigation has no frame yet (request.frame() throws); treat it as not the
// document under test, so only the host check can allow it.
const isMainDocumentRequest = (request) => {
  if (!request.isNavigationRequest()) return false
  try {
    return !request.frame().parentFrame()
  } catch {
    return false
  }
}

// Guards every page in the context (popups included) and every WebSocket they open.
export const test = base.extend({
  requestGuard: [
    async ({ context }, use) => {
      const disallowedUrls = []
      const recordIfDisallowed = (url, isMainDocument) => {
        if (!isAllowedRequest({ url, isMainDocument })) disallowedUrls.push(url)
      }
      const watchSockets = (watchedPage) =>
        watchedPage.on('websocket', (socket) => recordIfDisallowed(socket.url(), false))

      context.on('request', (request) =>
        recordIfDisallowed(request.url(), isMainDocumentRequest(request)),
      )
      context.pages().forEach(watchSockets)
      context.on('page', watchSockets)
      await use()
      expect(disallowedUrls, 'requests to disallowed destinations').toEqual([])
    },
    { auto: true },
  ],
})

export const SIMULATOR_TITLE = 'AI vs. Human Code Review Simulator'

const FIXED_START_MS = Date.parse('2026-01-05T09:00:00Z')
const CLOCK_PAUSE_OFFSET_MS = 60_000

// Opens the page under a fake clock that then stops: time only moves through page.clock.runFor.
export const openSimulator = async (page, url = '/') => {
  await page.clock.install({ time: FIXED_START_MS })
  await page.goto(url)
  await expect(page.getByRole('heading', { name: SIMULATOR_TITLE })).toBeVisible()
  await page.clock.pauseAt(FIXED_START_MS + CLOCK_PAUSE_OFFSET_MS)
}

const LANE_ID_LIST = ['human', 'ai']

export const laneLocator = (page, laneId) => page.locator(`[data-lane="${laneId}"]`)

export const metric = (page, laneId, name) =>
  laneLocator(page, laneId).locator(`[data-metric="${name}"]`)

export const buttonNamed = (page, name) => page.getByRole('button', { name, exact: true })

// Waiting for the toggled label means React has committed (and registered or cleared the
// interval) before the fake clock moves.
export const startSimulation = async (page) => {
  await buttonNamed(page, 'Start').click()
  await expect(buttonNamed(page, 'Pause')).toBeVisible()
}

export const pauseSimulation = async (page) => {
  await buttonNamed(page, 'Pause').click()
  await expect(buttonNamed(page, 'Start')).toBeVisible()
}

export const expectCounts = async (page, laneId, { pending, deployed }) => {
  await expect(metric(page, laneId, 'pending')).toHaveText(String(pending))
  await expect(metric(page, laneId, 'deployed')).toHaveText(String(deployed))
}

export const SECOND_MS = 1000
export const TICK_MS = 100
export const TICKS_PER_SECOND = SECOND_MS / TICK_MS

export const AI_GEN_LABEL = 'AI generation (PRs/hr)'
export const PR_SIZE_LABEL = 'PR size (LOC, both lanes)'

// Expected values from the plan's reference model (plan, "Default arithmetic" under "Slices").
// Per tick (0.1 h): a lane gains gen x 0.1 PRs of `size` LOC each, then reviews
// min(pending LOC, effective speed x 0.1) LOC, taking PRs off the queue in proportion.
// AI size = round(prSize x 1.51); AI effective speed = reviewer speed x skim.
// Ticks are 0.1 s each, so tick 10 is 1 s. Counts are the displayed (floored) values.
export const REFERENCE = Object.freeze({
  aiPrSizeAtDefaults: 378, // round(250 x 1.51)
  aiPrSizeAtPrSize200: 302, // round(200 x 1.51)
  aiPendingAtTick10: 18,
  aiDeployedAtTick10: 1,
  aiPendingAtTick11WithAiGen50: 23,
  aiPendingAtTick10WithAiGen40: 38,
  aiDeployedAtTick10WithAiGen40: 1,
  aiPendingAtTick30: 55,
  aiDeployedAtTick30: 4,
  aiPendingAtTick40: 73,
  aiDeployedAtTick40: 6,
  aiPendingAtTick100: 184,
  aiDeployedAtTick100: 15,
  humanDeployedAtTick100: 10,
  humanPendingAtTick20WithHumanGen10: 17,
  humanDeployedAtTick20WithHumanGen10: 2,
  aiDeployedAtTick11WithFasterReview: 2, // reviewer speed 1000, skim 3 -> 3000 LOC/hr
  // aiGen 40, prSize 300 (AI size 453, 60 LOC reviewed per tick), after 3 s:
  aiPendingAtTick30WithAiGen40AndPrSize300: 116,
  aiDeployedAtTick30WithAiGen40AndPrSize300: 3,
})

export const expectEmptyLanes = async (page) => {
  for (const laneId of LANE_ID_LIST) {
    await expectCounts(page, laneId, { pending: 0, deployed: 0 })
  }
}

export const slider = (page, name) => page.getByRole('slider', { name, exact: true })

export const setSlider = (page, name, value) => slider(page, name).fill(String(value))

// The visible value is a sibling span with id slider-value-<settingKey>; the slider is slider-<settingKey>.
export const visibleValue = async (sliderLocator) => {
  const sliderId = await sliderLocator.getAttribute('id')
  return sliderLocator.page().locator(`#${sliderId.replace('slider-', 'slider-value-')}`)
}

// The shown values of one metric as { human, ai }, keyed by each value's own lane.
export const metricValues = (page, name) =>
  page.evaluate(
    (metricName) =>
      Object.fromEntries(
        [...document.querySelectorAll(`[data-lane] [data-metric="${metricName}"]`)].map(
          (element) => [element.closest('[data-lane]').dataset.lane, Number(element.textContent)],
        ),
      ),
    name,
  )

// Lanes and the elapsed readout come from one React state, so they commit together.
// Waiting for the readout therefore tells us the lanes are current, with no clock-dependent waits.
export const expectElapsedAtTick = (page, tick) =>
  expect(
    page.getByText(`${(tick / TICKS_PER_SECOND).toFixed(1)} work hours`, { exact: true }),
  ).toBeVisible()

// Advances the fake clock one tick at a time, reading only after that tick has rendered.
export const sampleEachTick = async (page, { startTick, tickCount, read }) => {
  const samples = []
  for (let tickNumber = startTick + 1; tickNumber <= startTick + tickCount; tickNumber += 1) {
    await page.clock.runFor(TICK_MS)
    await expectElapsedAtTick(page, tickNumber)
    samples.push(await read())
  }
  return samples
}

const MAX_TABS_TO_REACH_A_CONTROL = 15

// Presses real Tab keys until the target holds focus; proves keyboard reachability.
export const tabTo = async (page, target) => {
  for (let presses = 0; presses < MAX_TABS_TO_REACH_A_CONTROL; presses += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error('Tab never reached the control')
}

// Starts the simulation, runs the fake clock, and waits until the elapsed readout shows the run
// has rendered. The readout shares one React state with the lanes, so the lanes are current too.
export const startAndRunFor = async (page, seconds) => {
  await startSimulation(page)
  await page.clock.runFor(seconds * SECOND_MS)
  await expectElapsedAtTick(page, seconds * TICKS_PER_SECOND)
}

// Resolves after any render React has already queued. React schedules renders on a
// MessageChannel, which page.clock does not fake, and ours is queued after React's.
export const flushPendingRenders = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const channel = new MessageChannel()
        channel.port1.onmessage = () => resolve()
        channel.port2.postMessage(null)
      }),
  )

export { expect }
