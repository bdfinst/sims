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

export const DEFAULT_SETTINGS = Object.freeze(
  Object.fromEntries(Object.entries(SLIDERS).map(([key, slider]) => [key, slider.defaultValue])),
)

// The only place derived lane values come from.
export const laneParams = (settings, laneModel) => ({
  gen: settings[laneModel.genSetting],
  size: Math.round(settings.prSize * laneModel.sizeMultiplier),
  effSpeed: settings.reviewerSpeed * (laneModel.skimApplies ? settings.skim : 1),
})
