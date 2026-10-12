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
const BASE_DETECTION = 0.8
const SIZE_KNEE = 200
const SIZE_WALL = 400
const SIZE_FLOOR = 0.05
const SPEED_KNEE = 500
const SPEED_WALL = 1000
const SPEED_FLOOR = 0.1
const EMPTY_QUEUE_EPSILON = 1e-9
const DISPLAY_EPSILON = 1e-9

// escapedDefects is the model's term; the UI calls it "Incidents".
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

// Full strength up to the knee, then a straight line down to the floor at the wall.
const fallOff = (value, { knee, wall, floor }) => {
  if (value <= knee) return 1
  if (value >= wall) return floor
  return 1 - (1 - floor) * ((value - knee) / (wall - knee))
}

export const sizeFactor = (prSizeLoc) =>
  fallOff(prSizeLoc, { knee: SIZE_KNEE, wall: SIZE_WALL, floor: SIZE_FLOOR })

export const speedFactor = (locPerHour) =>
  fallOff(locPerHour, { knee: SPEED_KNEE, wall: SPEED_WALL, floor: SPEED_FLOOR })

// Share of a PR's defects that a review catches, from its size and the reviewer's speed.
export const detection = (prSizeLoc, locPerHour) =>
  BASE_DETECTION * sizeFactor(prSizeLoc) * speedFactor(locPerHour)

export const formatPct = (share) => `${Math.round(share * 100)}%`

// Defects caught is shown from the lane's nominal size and speed, not from the queue's mix.
export const formatDefectsCaught = ({ size, effSpeed }) => formatPct(detection(size, effSpeed))

export const formatLoc = (loc) => floorShow(loc).toLocaleString('en-US')

export const NO_VALUE = '—'

// The one rule for the PR counts a lane shows; the warning check and the "—" rules use it too.
export const displayedPending = (lane) => floorShow(lane.pendingPrs)
export const displayedDeployed = (lane) => floorShow(lane.deployedPrs)
// How many tiles to draw for `displayed` pending PRs, and how many PRs they do not cover.
export const tileLayout = (displayed, capacity) => ({
  tiles: Math.min(displayed, capacity),
  overflow: Math.max(0, displayed - capacity),
})

export const displayedIncidents = (lane) => floorShow(lane.escapedDefects)

// The only place the warning comparison is made. Pass the displayed count (displayedPending), so
// the number, the tiles and the warning always agree.
export const isOverThreshold = (displayed, threshold) => displayed > threshold

const hasDeployedWholePr = (lane) => displayedDeployed(lane) >= 1

// Escaped defects per deployed PR, from the internal (unfloored) Deployed count.
const incidentsPerPr = (lane) => lane.escapedDefects / lane.deployedPrs

export const formatIncidentsPerPr = (lane) =>
  hasDeployedWholePr(lane) ? incidentsPerPr(lane).toFixed(2) : NO_VALUE

// Hours until the queue is cleared at the lane's effective speed (the unit is added by the view).
export const formatPickupWaitHours = (lane, { effSpeed }) => (lane.pendingLoc / effSpeed).toFixed(1)

// How many times more incidents per PR the AI lane has than the Human lane; blank until both
// lanes have shipped a PR. Takes the lanes by id so no caller can swap numerator and denominator.
export const formatHeadlineRatio = (lanes) => {
  const aiLane = lanes[LANE_IDS.ai]
  const humanLane = lanes[LANE_IDS.human]
  if (!hasDeployedWholePr(aiLane) || !hasDeployedWholePr(humanLane)) return NO_VALUE
  const ratio = incidentsPerPr(aiLane) / incidentsPerPr(humanLane)
  return Number.isFinite(ratio) ? `${ratio.toFixed(2)}×` : NO_VALUE
}

export const tick = (lane, { gen, size, effSpeed }) => {
  const generatedPrs = gen * TICK_HOURS
  const queuedPrs = lane.pendingPrs + generatedPrs
  const queuedLoc = lane.pendingLoc + generatedPrs * size

  const avgSize = queuedPrs > EMPTY_QUEUE_EPSILON ? queuedLoc / queuedPrs : size
  const detectionRate = detection(avgSize, effSpeed)

  const reviewedLoc = Math.min(queuedLoc, effSpeed * TICK_HOURS)
  const hasQueuedWork = queuedLoc > EMPTY_QUEUE_EPSILON
  // PRs leave the queue in proportion to the LOC reviewed, so a queue of mixed sizes deploys PRs
  // in step with its LOC. Written as (PRs x reviewed LOC) / queued LOC, float rounding can leave
  // the result a hair above queuedPrs, which is why the queue is clamped below.
  const reviewedPrs = hasQueuedWork ? (queuedPrs * reviewedLoc) / queuedLoc : 0

  return {
    pendingPrs: Math.max(0, queuedPrs - reviewedPrs),
    pendingLoc: Math.max(0, queuedLoc - reviewedLoc),
    deployedPrs: lane.deployedPrs + reviewedPrs,
    deployedLoc: lane.deployedLoc + reviewedLoc,
    escapedDefects: lane.escapedDefects + reviewedLoc * DEFECTS_PER_LOC * (1 - detectionRate),
  }
}
