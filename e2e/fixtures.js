import { test as base, expect } from '@playwright/test'
import { TICK_MS } from '../src/engine.js'

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

export const ALL_LANE_IDS = ['human', 'ai']
export const NO_VALUE = '—'

export const laneLocator = (page, laneId) => page.locator(`[data-lane="${laneId}"]`)

export const metric = (page, laneId, name) =>
  laneLocator(page, laneId).locator(`[data-metric="${name}"]`)

export const buttonNamed = (page, name) => page.getByRole('button', { name, exact: true })

// Waiting for the toggled label means the click's render has committed. A click is a discrete
// event, so React flushes that render and its interval effect synchronously. A pause caused by
// visibilitychange is not a click: use flushPendingRenders after it instead.
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

export const expectPending = (page, laneId, count) =>
  expect(metric(page, laneId, 'pending')).toHaveText(String(count))

const QUEUE_LABEL_BY_LANE = { human: 'Human', ai: 'AI' }

// The red of the warning state: --color-warning (#ef4444) in src/index.css.
export const WARNING_BORDER_COLOR = 'rgb(239, 68, 68)'
// The dark page: --color-canvas (#0b0d12) in src/index.css.
export const PAGE_BACKGROUND = 'rgb(11, 13, 18)'

export const FULL_RUN_SECONDS = 10
// Declared here on purpose: data-state is a fixed hook, so a rename in the app must fail the tests.
export const QUEUE_STATE = Object.freeze({ warning: 'warning', normal: 'normal' })

// Anchored on data-capacity (one per box), so the tiles inside the box can never match.
export const queueBox = (page, laneId) => laneLocator(page, laneId).locator('[data-capacity]')

// The lane shows `count` pending PRs and its queue box is in `state` (QUEUE_STATE.*).
export const expectQueueState = async (page, laneId, count, state) => {
  await expectPending(page, laneId, count)
  await expect(queueBox(page, laneId)).toHaveAttribute('data-state', state)
}

// Everything a warning looks like: the state, the alert icon, the red border, the announcement.
export const expectWarningShown = async (page, laneId) => {
  const box = queueBox(page, laneId)
  await expect(box).toHaveAttribute('data-state', QUEUE_STATE.warning)
  await expect(box.locator('[data-icon="triangle-alert"]')).toBeVisible()
  await expect(box).toHaveCSS('border-color', WARNING_BORDER_COLOR)
  await expect(laneLocator(page, laneId).getByRole('status')).toHaveText(
    `${QUEUE_LABEL_BY_LANE[laneId]} Pending Review over threshold`,
  )
}

// The tiles a queue box draws and the overflow text it adds ("+N more").
export const tilesIn = (page, laneId) => queueBox(page, laneId).locator('[data-tile]')
export const overflowIn = (page, laneId) => queueBox(page, laneId).getByText(/^\+\d+ more$/)

// The capacity C the app puts on the queue box; specs never hard-code it.
export const readTileCapacity = async (page) =>
  Number(await queueBox(page, 'human').getAttribute('data-capacity'))

export const SECOND_MS = 1000
export { TICK_MS }
export const TICKS_PER_SECOND = SECOND_MS / TICK_MS
export const ticksToSeconds = (ticks) => ticks / TICKS_PER_SECOND

export const HUMAN_GEN_LABEL = 'Human generation (PRs/hr)'
export const AI_GEN_LABEL = 'AI generation (PRs/hr)'
export const PR_SIZE_LABEL = 'PR size (LOC, both lanes)'
export const REVIEWER_SPEED_LABEL = 'Reviewer speed (LOC/hr, both lanes)'
export const AI_SKIM_LABEL = 'AI skim multiplier'
export const THRESHOLD_LABEL = 'Warning threshold'

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
  // Incidents = reviewed LOC x 0.02 x (1 - detection). Internal values at 10 s: Human 19.5 escaped
  // over 10 deployed PRs (1.95 per PR); AI 107.8378 over 15.8730 deployed PRs (6.79 per PR, from the
  // unrounded values, and not 107 / 15). The displayed Incidents are those escapes floored.
  humanIncidentsAtTick100: 19,
  humanIncidentsPerPrAtTick100: '1.95',
  aiIncidentsAtTick100: 107,
  aiIncidentsPerPrAtTick100: '6.79',
  aiPendingLocAtTick100: '69,600', // 100 ticks x (756 generated - 60 reviewed) LOC
  aiPickupWaitAtTick100: '116.0 h', // 69,600 LOC / 600 LOC/hr
  headlineRatioAtTick100: '3.48×', // 6.79 / 1.95 from the internal values
  humanDeployedAtTick9: 0,
  humanIncidentsPerPrAtTick10: '1.95',
  // PR size 400, 10 s: detection falls to 4%, so each reviewed LOC escapes far more often.
  humanPendingAtTick100WithPrSize400: 2,
  humanDeployedAtTick100WithPrSize400: 7,
  humanIncidentsAtTick100WithPrSize400: 57,
  humanIncidentsPerPrAtTick100WithPrSize400: '7.68',
  // Defaults for 1 s, then PR size 400 for the remaining 9 s: only the later reviews escape more.
  humanIncidentsAtTick100AfterSizeChangeAtTick10: 53,
  humanIncidentsPerPrAtTick100AfterSizeChangeAtTick10: '6.94',
  humanDefectsCaughtAtPrSize400: '4%',
  // humanGen 10 for 2 s gives 17 PRs / 4,400 LOC queued; PR size 500 for 1 more second adds
  // 10 x 500 LOC and reviews 300 LOC: 26 PRs / 9,100 LOC.
  humanPendingLocAtTick20WithHumanGen10: '4,400',
  humanPendingAtTick20WithHumanGen10: 17,
  humanDeployedAtTick20WithHumanGen10: 2,
  aiPendingAtTick20WithHumanGen10: 36, // the AI lane does not depend on humanGen
  humanPendingAtTick30AfterSizeChangeToPrSize500: 26,
  humanPendingLocAtTick30AfterSizeChangeToPrSize500: '9,100',
  // Displayed Pending Review while the AI lane (2 PRs generated per tick, about 0.16 reviewed) and
  // the Human lane at humanGen 10 (1 PR generated per tick, 0.12 reviewed) fall behind.
  aiPendingAtTick5: 9,
  aiPendingAtTick8: 14,
  aiPendingAtTick9: 16,
  aiPendingAtTick12: 22,
  humanPendingAtTick18WithHumanGen10: 15,
  humanPendingAtTick19WithHumanGen10: 16,
  // Then humanGen 1 and reviewer speed 1000: each tick adds 0.1 PR and reviews 100 LOC (0.4 PR).
  humanPendingAtTick25AfterDraining: 16,
  humanPendingAtTick26AfterDraining: 15,
  humanDefectsCaughtWhenDrained: '6%', // PR size 250 at 1000 LOC/hr: 0.8 x 0.7625 x 0.1
  aiDeployedAtTick11WithFasterReview: 2, // reviewer speed 1000, skim 3 -> 3000 LOC/hr
  // aiGen 40, prSize 300 (AI size 453, 60 LOC reviewed per tick), after 3 s:
  aiPendingAtTick30WithAiGen40AndPrSize300: 116,
  aiDeployedAtTick30WithAiGen40AndPrSize300: 3,
})

export const headline = (page) => page.locator('[data-metric="headlineRatio"]')

// samples are { human, ai } values read once per tick; none may be lower than the one before.
export const expectNeverDecreases = (samples) => {
  const decreases = samples
    .slice(1)
    .filter((current, sampleIndex) =>
      Object.entries(current).some(([laneId, value]) => value < samples[sampleIndex][laneId]),
    )
  expect(decreases).toEqual([])
}

export const expectEmptyLanes = async (page) => {
  for (const laneId of ALL_LANE_IDS) {
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

// Runs the fake clock for `seconds`, then waits until the elapsed readout shows `totalSeconds`
// (the run's total so far), so the render for those ticks has happened before any assertion.
export const advanceSeconds = async (page, seconds, totalSeconds) => {
  await page.clock.runFor(seconds * SECOND_MS)
  await expectElapsedAtTick(page, Math.round(totalSeconds * TICKS_PER_SECOND))
}

// From a fresh or just-reset page: starts the simulation, runs the fake clock, and waits until the
// elapsed readout shows the run has rendered. The readout shares one React state with the lanes,
// so the lanes are current too.
export const startAndRunFor = async (page, seconds) => {
  await startSimulation(page)
  await page.clock.runFor(seconds * SECOND_MS)
  await expectElapsedAtTick(page, seconds * TICKS_PER_SECOND)
}

// Resolves after any render React has already queued. React schedules renders on a
// MessageChannel, which page.clock does not fake, and ours is queued after React's.
// It covers renders only: it does not guarantee that an effect cleanup (such as clearing the
// interval) has run. After a visibility-driven pause, wait for a positive DOM result first.
export const flushPendingRenders = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const channel = new MessageChannel()
        channel.port1.onmessage = () => resolve()
        channel.port2.postMessage(null)
      }),
  )

export const expectNoHorizontalScroll = async (page) => {
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scroll.scrollWidth, 'page scroll width').toBeLessThanOrEqual(scroll.clientWidth)
}

// Text and background colours as sRGB bytes. A canvas converts any CSS colour (including the
// oklch greys Tailwind uses); a transparent background falls back to the nearest opaque ancestor.
export const textColors = (locator) =>
  locator.evaluate((element) => {
    const toRgba = (cssColor) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')
      context.fillStyle = cssColor
      context.fillRect(0, 0, 1, 1)
      return [...context.getImageData(0, 0, 1, 1).data]
    }
    const OPAQUE = 255
    const layers = []
    for (let holder = element; holder; holder = holder.parentElement) {
      const layer = toRgba(getComputedStyle(holder).backgroundColor)
      if (layer[3] > 0) layers.push(layer)
      if (layer[3] === OPAQUE) break
    }
    // Composite translucent backgrounds (e.g. bg-white/5) over what lies beneath them.
    const background = layers.reduceRight(
      (beneath, [red, green, blue, alpha]) =>
        [red, green, blue].map(
          (channel, index) => (channel * alpha + beneath[index] * (OPAQUE - alpha)) / OPAQUE,
        ),
      [0, 0, 0],
    )
    return {
      foreground: toRgba(getComputedStyle(element).color).slice(0, 3),
      background,
    }
  })

// WCAG 2 relative luminance and contrast ratio.
const luminance = (rgb) => {
  const [red, green, blue] = rgb.map((byte) => {
    const channel = byte / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}
export const contrastRatio = ({ foreground, background }) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

export const RESEARCH_TITLE = 'Research behind this simulation'
export const researchToggle = (page) => page.locator('summary', { hasText: RESEARCH_TITLE })
export const researchPanel = (page) => page.locator('details')

export { expect }
