// Pure simulation model: no React, no DOM, no presentation concerns.

export const LANE_IDS = Object.freeze({ human: 'human', ai: 'ai' })

// Numeric lane model. Presentation (labels, icons, classes) lives in laneConfig.js.
export const LANE_MODELS = Object.freeze({
  [LANE_IDS.human]: Object.freeze({
    genSetting: 'humanGen',
    sizeMultiplier: 1,
    skimApplies: false,
  }),
  [LANE_IDS.ai]: Object.freeze({ genSetting: 'aiGen', sizeMultiplier: 1.51, skimApplies: true }),
})

// Slider table: the single source of defaults and ranges (spec State table).
export const SLIDERS = Object.freeze({
  humanGen: Object.freeze({ min: 1, max: 10, step: 1, defaultValue: 1 }),
  aiGen: Object.freeze({ min: 5, max: 50, step: 1, defaultValue: 20 }),
  prSize: Object.freeze({ min: 50, max: 1000, step: 10, defaultValue: 250 }),
  reviewerSpeed: Object.freeze({ min: 100, max: 1000, step: 50, defaultValue: 300 }),
  skim: Object.freeze({ min: 1, max: 3, step: 0.5, defaultValue: 2 }),
  threshold: Object.freeze({ min: 5, max: 50, step: 1, defaultValue: 15 }),
})

// Clamps to the slider's range and snaps to its step, so no caller can store an illegal setting.
export const snapToSlider = (settingKey, rawValue) => {
  const { min, max, step } = SLIDERS[settingKey]
  const snapped = min + Math.round((rawValue - min) / step) * step
  return Math.min(max, Math.max(min, snapped))
}

export const DEFAULT_SETTINGS = Object.freeze(
  Object.fromEntries(Object.entries(SLIDERS).map(([key, slider]) => [key, slider.defaultValue])),
)

// The only place derived lane values come from.
export const laneParams = (settings, laneModel) => ({
  gen: settings[laneModel.genSetting],
  size: Math.round(settings.prSize * laneModel.sizeMultiplier),
  effSpeed: settings.reviewerSpeed * (laneModel.skimApplies ? settings.skim : 1),
})

// --- Tick model ---------------------------------------------------------------

export const TICK_HOURS = 0.1
export const SECONDS_PER_WORK_HOUR = 1
export const MS_PER_WORK_HOUR = SECONDS_PER_WORK_HOUR * 1000
export const TICK_MS = TICK_HOURS * MS_PER_WORK_HOUR
const DEFECTS_PER_LOC = 0.02
const EMPTY_QUEUE_EPSILON = 1e-9
const DISPLAY_EPSILON = 1e-9

export const emptyLane = () => ({
  pendingPrs: 0,
  pendingLoc: 0,
  deployedPrs: 0,
  deployedLoc: 0,
  escapedDefects: 0,
})

// Counts show the floor of the internal value; the epsilon absorbs float drift (9.9999999999 -> 10).
export const floorShow = (value) => Math.floor(value + DISPLAY_EPSILON)

export const formatElapsedHours = (ticks) => (ticks * TICK_HOURS).toFixed(1)

// Placeholder: reviewers catch nothing until the size/speed detection curves exist.
const detection = (_avgSize, _effSpeed) => 0

export const tick = (lane, { gen, size, effSpeed }) => {
  const generatedPrs = gen * TICK_HOURS
  const queuedPrs = lane.pendingPrs + generatedPrs
  const queuedLoc = lane.pendingLoc + generatedPrs * size

  const avgSize = queuedPrs > EMPTY_QUEUE_EPSILON ? queuedLoc / queuedPrs : size
  const detectionRate = detection(avgSize, effSpeed)

  const reviewedLoc = Math.min(queuedLoc, effSpeed * TICK_HOURS)
  const hasQueuedWork = queuedLoc > EMPTY_QUEUE_EPSILON
  // Plan's evaluation order: (queued PRs x reviewed LOC) / queued LOC. Float rounding can leave the
  // result a hair above queuedPrs, which is why the queue is clamped below.
  const reviewedPrs = hasQueuedWork ? (queuedPrs * reviewedLoc) / queuedLoc : 0

  return {
    pendingPrs: Math.max(0, queuedPrs - reviewedPrs),
    pendingLoc: Math.max(0, queuedLoc - reviewedLoc),
    deployedPrs: lane.deployedPrs + reviewedPrs,
    deployedLoc: lane.deployedLoc + reviewedLoc,
    escapedDefects: lane.escapedDefects + reviewedLoc * DEFECTS_PER_LOC * (1 - detectionRate),
  }
}
