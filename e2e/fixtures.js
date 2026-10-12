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

// Counts the page's live setInterval handles. It runs after page.clock.install's own init script,
// so it wraps the clock's fake setInterval/clearInterval (the ones the app calls).
const trackLiveIntervals = () => {
  const liveHandles = new Set()
  const { setInterval: clockSetInterval, clearInterval: clockClearInterval } = window
  window.setInterval = (...args) => {
    const handle = clockSetInterval(...args)
    liveHandles.add(handle)
    return handle
  }
  window.clearInterval = (handle) => {
    liveHandles.delete(handle)
    clockClearInterval(handle)
  }
  window.liveIntervalCount = () => liveHandles.size
}

// Retries until the count settles: an effect cleanup (clearing the interval) can run just after
// the render that shows the paused state.
export const expectLiveIntervals = (page, count) =>
  expect
    .poll(() => page.evaluate(() => window.liveIntervalCount()), {
      message: 'live setInterval handles',
    })
    .toBe(count)

export const expectSimulatorOpen = (page) =>
  expect(page.getByRole('heading', { name: SIMULATOR_TITLE })).toBeVisible()

export const expectViewport = (page, viewport) => expect(page.viewportSize()).toEqual(viewport)

// Opens the page under a fake clock that then stops: time only moves through page.clock.runFor.
export const openSimulator = async (page, url = '/') => {
  await page.clock.install({ time: FIXED_START_MS })
  await page.addInitScript(trackLiveIntervals)
  await page.goto(url)
  await expectSimulatorOpen(page)
  await page.clock.pauseAt(FIXED_START_MS + CLOCK_PAUSE_OFFSET_MS)
}

export const ALL_LANE_IDS = ['human', 'ai']
export const NO_VALUE = '—'

export const laneLocator = (page, laneId) => page.locator(`[data-lane="${laneId}"]`)

export const metric = (page, laneId, name) =>
  laneLocator(page, laneId).locator(`[data-metric="${name}"]`)

export const buttonNamed = (page, name) => page.getByRole('button', { name, exact: true })

// Declared here on purpose, not imported from src/research.js: a rename of the title (or, in
// research.spec.js, of a source URL) must fail the tests, so these are independent oracles.
export const RESEARCH_TITLE = 'Research behind this simulation'
export const researchToggle = (page) => page.locator('summary', { hasText: RESEARCH_TITLE })
export const researchPanel = (page) => page.locator('details', { has: researchToggle(page) })
// The link in a finding's list item (the assumptions note links Faros a second time).
export const sourceLink = (page, url) =>
  researchPanel(page).locator('li').locator(`a[href="${url}"]`)
export const openResearchPanel = async (page) => {
  await researchToggle(page).click()
  await expect(researchPanel(page)).toHaveAttribute('open', '')
}

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

export const expectPending = (page, laneId, count) =>
  expect(metric(page, laneId, 'pending')).toHaveText(String(count))

export const expectDeployed = (page, laneId, count) =>
  expect(metric(page, laneId, 'deployed')).toHaveText(String(count))

export const expectCounts = async (page, laneId, { pending, deployed }) => {
  await expectPending(page, laneId, pending)
  await expectDeployed(page, laneId, deployed)
}

const QUEUE_LABEL_BY_LANE = { human: 'Human', ai: 'AI' }

// The red of the warning state: --color-warning (#ef4444) in src/index.css.
export const WARNING_BORDER_COLOR = 'rgb(239, 68, 68)'
// The dark page: --color-canvas (#0b0d12) in src/index.css.
export const PAGE_BACKGROUND = 'rgb(11, 13, 18)'

export const FULL_RUN_SECONDS = 10
// Setting values and run lengths several specs share (e2e-only; the unit tests keep their own).
export const DRAIN_SECONDS = 6
export const NEXT_TICK_SECONDS = 0.1
// The busy-AI preset leaves 115 PRs pending after 30 s, beyond any tile capacity C (at most 98).
export const OVERFLOW_RUN_SECONDS = 30
// Declared here on purpose: data-state is a fixed hook, so a rename in the app must fail the tests.
export const QUEUE_STATE = Object.freeze({ warning: 'warning', normal: 'normal' })

// Anchored on data-capacity (one per box), so the tiles inside the box can never match.
export const queueBox = (page, laneId) => laneLocator(page, laneId).locator('[data-capacity]')

// The lane shows `count` pending PRs and its queue box is in `state` (QUEUE_STATE.*).
export const expectQueueState = async (page, laneId, count, state) => {
  await expectPending(page, laneId, count)
  await expect(queueBox(page, laneId)).toHaveAttribute('data-state', state)
}

// What a warning box looks like: the state, the alert icon, and the red border.
export const expectWarningBox = async (page, laneId) => {
  const box = queueBox(page, laneId)
  await expect(box).toHaveAttribute('data-state', QUEUE_STATE.warning)
  await expect(box.locator('[data-icon="triangle-alert"]')).toBeVisible()
  await expect(box).toHaveCSS('border-color', WARNING_BORDER_COLOR)
}

// The lane's status element announces the warning.
export const expectWarningAnnounced = (page, laneId) =>
  expect(laneLocator(page, laneId).getByRole('status')).toHaveText(
    `${QUEUE_LABEL_BY_LANE[laneId]} Pending Review over threshold`,
  )

// The tiles a queue box draws and the overflow text it adds ("+N more").
export const tilesIn = (page, laneId) => queueBox(page, laneId).locator('[data-tile]')
export const overflowIn = (page, laneId) => queueBox(page, laneId).getByText(/^\+\d+ more$/)

// The capacity C the app puts on the queue box; specs never hard-code it.
export const readTileCapacity = async (page) =>
  Number(await queueBox(page, 'human').getAttribute('data-capacity'))

// Plan AC12: C is between 22 (the busy-AI queue at 5.7 s) and 98 (the exact preset's n after n ticks).
const MIN_TILE_CAPACITY = 22
const MAX_TILE_CAPACITY = 98

// Background of the tile and layout scenarios: opens the page and reads C from the queue box.
export const openAndReadCapacity = async (page) => {
  await openSimulator(page)
  const capacity = await readTileCapacity(page)
  expect(capacity, 'queue tile capacity C').toBeGreaterThanOrEqual(MIN_TILE_CAPACITY)
  expect(capacity, 'queue tile capacity C').toBeLessThanOrEqual(MAX_TILE_CAPACITY)
  return capacity
}

export const SECOND_MS = 1000
// Spec: the tick period is 100 ms. Declared here, not imported from src/engine.js, so a change to
// the app's tick period fails the tests (an independent oracle, like the other constants).
export const TICK_MS = 100
export const TICKS_PER_SECOND = SECOND_MS / TICK_MS
const ticksToSeconds = (ticks) => ticks / TICKS_PER_SECOND

export const HUMAN_CODE_WRITTEN_LABEL = 'Human code written (LOC/hr)'
export const HUMAN_PRS_PER_DAY_LABEL = 'Human PRs per day'
export const AI_CODE_WRITTEN_LABEL = 'AI code written (LOC/hr)'
export const REVIEWER_SPEED_LABEL = 'Reviewer speed (LOC/hr, both lanes)'
export const AI_SKIM_LABEL = 'AI skim multiplier'
export const THRESHOLD_LABEL = 'Warning threshold'

// Slider presets for the generation model, as { slider label: value } for setSliders. The values
// come from the plan's "Default arithmetic" and are independent of src. Everything not listed
// stays at its default.
// Busy AI: +0.38631 AI pending PR per tick, so 3 PRs pending at 1 s and 115 at 30 s.
export const BUSY_AI_PRESET = Object.freeze({ [AI_CODE_WRITTEN_LABEL]: 2000 })
// Exact: the AI lane gains exactly one pending PR per tick, so Pending Review is n after n ticks.
export const EXACT_AI_PRESET = Object.freeze({
  [HUMAN_CODE_WRITTEN_LABEL]: 5,
  [REVIEWER_SPEED_LABEL]: 100,
  [AI_SKIM_LABEL]: 1,
  [AI_CODE_WRITTEN_LABEL]: 704,
})
// Human backlog: 400 LOC human PRs; the human queue gains one PR every 4 s (6 pending at 24 s).
export const HUMAN_BACKLOG_PRESET = Object.freeze({
  [HUMAN_CODE_WRITTEN_LABEL]: 200,
  [HUMAN_PRS_PER_DAY_LABEL]: 4,
  [REVIEWER_SPEED_LABEL]: 100,
})
// Drain: the settings the drain scenarios switch a busy AI lane to (AI effective speed 2000 LOC/hr).
export const AI_DRAIN_SETTINGS = Object.freeze({
  [AI_CODE_WRITTEN_LABEL]: 5,
  [REVIEWER_SPEED_LABEL]: 1000,
})

// Expected values from the plan's reference model (plan, "Default arithmetic" under "Slices").
// Per tick (0.1 h): a lane gains gen x 0.1 PRs of `size` LOC each, then reviews
// min(pending LOC, effective speed x 0.1) LOC, taking PRs off the queue in proportion.
// AI effective speed = reviewer speed x skim. Ticks are 0.1 s each, so tick 10 is 1 s. Counts are
// the displayed (floored) values.
export const REFERENCE = Object.freeze({
  // Generation model (plan, "Default arithmetic"). Internal values in brackets.
  // Defaults: both queues stay empty; a human PR is 240 LOC, reviewed at 3 LOC per tick.
  defaultHumanDeployedAtTick79: 0, // (0.9875)
  defaultHumanDeployedAtTick80: 1,
  defaultHumanPendingAtTick100: 0,
  defaultHumanDeployedAtTick100: 1, // (1.25)
  defaultAiPendingAtTick100: 0,
  defaultAiDeployedAtTick100: 1, // (1.4625)
  // Incidents = reviewed LOC x 0.02 x (1 - detection). Detection is fixed at the defaults, so
  // incidents per PR are too: Human 240 x 0.02 x 0.352 = 1.6896, AI 362.4 x 0.02 x 0.85004 = 6.161.
  defaultHumanIncidentsAtTick100: 2, // (2.112)
  defaultAiIncidentsAtTick100: 9, // (9.010)
  defaultHumanIncidentsPerPr: '1.69',
  defaultAiIncidentsPerPr: '6.16',
  defaultHeadlineRatio: '3.65×', // 6.161 / 1.6896
  // Human code written 50 (PR size 400, detection 4%) from the start: 1.25 deployed, 9.6 incidents.
  largeHumanPrPendingAtTick100: 0,
  largeHumanPrDeployedAtTick100: 1,
  largeHumanPrIncidentsAtTick100: 9,
  largeHumanPrIncidentsPerPrAtTick100: '7.68',
  // Defaults for 1 s, then one Human change (AC7c): Defects caught on the next tick, then the
  // Human lane at 10 s.
  // Human code written 50: PR size 400.
  humanDefectsCaughtAfterCodeWritten50: '4%',
  humanIncidentsAtTick100AfterCodeWritten50: 8, // (8.851)
  humanIncidentsPerPrAtTick100AfterCodeWritten50: '7.08',
  // Human PRs per day 0.25: PR size 960, so no whole PR is deployed by 10 s.
  humanDefectsCaughtAfterPrsPerDay025: '4%',
  humanIncidentsAtTick100AfterPrsPerDay025: 5, // (5.395)
  humanDeployedAtTick100AfterPrsPerDay025: 0, // (0.406)
  // Reviewer speed 900: 0.8 x 0.81 x 0.28 = 0.181.
  humanDefectsCaughtAfterReviewerSpeed900: '18%',
  humanIncidentsAtTick100AfterReviewerSpeed900: 4, // (4.631)
  humanIncidentsPerPrAtTick100AfterReviewerSpeed900: '3.71',
  // Busy-AI preset (AI code written 2000): 0.55188 PR generated and 0.16556 PR reviewed per tick,
  // so +0.38631 pending PR per tick; the Human lane runs at its defaults.
  busyAiPendingAtTick10: 3, // (3.863)
  busyAiDeployedAtTick10: 1, // (1.656)
  busyAiPendingAtTick20: 7, // (7.726)
  busyAiPendingLocAtTick20: '2,800', // 20 ticks x (200 generated - 60 reviewed) LOC
  busyAiPendingAtTick30: 11, // (11.589)
  busyAiDeployedAtTick30: 4, // (4.967)
  busyAiPendingAtTick38: 14, // (14.680)
  busyAiPendingAtTick39: 15, // (15.066)
  busyAiPendingAtTick40: 15, // between 3.9 s (15.066) and 4.2 s (16.225)
  busyAiDeployedAtTick40: 6, // 40 x 0.16556 (6.622)
  busyAiPendingAtTick42: 16, // (16.225)
  busyAiPendingAtTick50: 19, // (19.316)
  busyAiPendingAtTick57: 22, // (22.020)
  busyAiPendingAtTick60: 23, // (23.179)
  busyAiPendingAtTick100: 38, // (38.631)
  busyAiPendingAtTick300: 115, // (115.894)
  busyAiDeployedAtTick100: 16, // 100 x 0.16556 (16.556)
  // Plan, Slice 2 check: from the busy-AI state at 1 s, one more tick with reviewer speed 1000 and
  // skim 3 reviews 300 LOC (AI deployed 2.483); with reviewer speed 100, pending reaches 4.360.
  busyAiDeployedAtTick11WithFasterReview: 2,
  busyAiPendingAtTick11WithSlowReview: 4,
  // Plan, Slice 4: paused at 2 s, Human PRs per day set to 0.5 (AI PR size 724.8), then 1 s more.
  // The 2,800 queued LOC keep their size; 10 more ticks add 140 LOC each.
  busyAiPendingAtTick30AfterHumanPrsPerDay05: 9,
  busyAiPendingLocAtTick30AfterHumanPrsPerDay05: '4,200',
  // Plan, Slice 5 check: from 5 s, AI_DRAIN_SETTINGS remove 0.551 PR per tick (16.01 at 5.6 s,
  // 15.46 at 5.7 s); from 2 s they empty the queue well within 6 s.
  busyAiPendingAtTick56AfterDraining: 16,
  busyAiPendingAtTick57AfterDraining: 15,
  drainedAiDefectsCaught: '2%', // PR size 362.4 at 2000 LOC/hr: 0.8 x 0.2286 x 0.1 = 0.018
  // Human backlog preset plus AI code written 2000, at 24 s.
  humanBacklogPendingAtTick240: 6,
  humanBacklogAiPendingAtTick240: 71,
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

// Sets several sliders in order: setSliders(page, { 'Human PRs per day': 0.5, ... }) or a preset.
export const setSliders = async (page, valuesByLabel) => {
  for (const [label, value] of Object.entries(valuesByLabel)) await setSlider(page, label, value)
}

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
    page.getByText(`${ticksToSeconds(tick).toFixed(1)} work hours`, { exact: true }),
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

// The elapsed readout in ticks ("3.0 work hours" is 30).
const elapsedTicks = async (page) => {
  const readout = await page.getByText(/^\d+\.\d work hours$/).textContent()
  return Math.round(Number.parseFloat(readout) * TICKS_PER_SECOND)
}

// For a running simulation: runs the fake clock for `seconds`, then waits until the elapsed readout
// has advanced by that many ticks. The readout shares one React state with the lanes, so once it
// shows the new time the lanes are current too, with no clock-dependent waits.
export const runFor = async (page, seconds) => {
  const startTick = await elapsedTicks(page)
  await page.clock.runFor(seconds * SECOND_MS)
  await expectElapsedAtTick(page, startTick + Math.round(seconds * TICKS_PER_SECOND))
}

// From a fresh or just-reset page: presses Start, then runs for `seconds`.
export const startAndRunFor = async (page, seconds) => {
  await startSimulation(page)
  await runFor(page, seconds)
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

export const PHONE = { width: 375, height: 667 }
export const NARROWEST_PHONE = { width: 320, height: 568 } // WCAG 1.4.10 reflow
export const MIN_TEXT_CONTRAST = 4.5 // WCAG 1.4.3, normal-size text

// The right and bottom edges of a bounding box.
export const rightOf = ({ x, width }) => x + width
export const bottomOf = ({ y, height }) => y + height

export const expectNoHorizontalScroll = async (page) => {
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scroll.scrollWidth, 'page scroll width').toBeLessThanOrEqual(scroll.clientWidth)
}

// Text and background colours as sRGB bytes. A canvas converts any CSS colour (including the
// oklch greys Tailwind uses); translucent backgrounds are composited over the ancestors behind them.
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
    const [red, green, blue, alpha] = toRgba(getComputedStyle(element).color)
    // A translucent text colour is seen blended with the background behind it.
    const foreground = [red, green, blue].map(
      (channel, index) => (channel * alpha + background[index] * (OPAQUE - alpha)) / OPAQUE,
    )
    return { foreground, background }
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

export { expect }
