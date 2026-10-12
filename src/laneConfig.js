// Presentation only. Numeric behavior lives in engine.js.
// Tailwind class strings must stay complete literals so the scanner finds them.

import { LANE_IDS } from './engine.js'

export const LANE_PRESENTATION = Object.freeze({
  [LANE_IDS.human]: Object.freeze({
    label: 'Human',
    accent: 'blue',
    generationIcon: 'user',
    reviewIcon: 'eye',
    accentBorderClass: 'border-human',
    accentTextClass: 'text-human',
    accentSliderClass: 'accent-human',
    generationSliders: ['humanGen', 'prSize'],
    reviewSliders: ['reviewerSpeed'],
    showsDerivedValues: false,
  }),
  [LANE_IDS.ai]: Object.freeze({
    label: 'AI',
    accent: 'purple',
    generationIcon: 'bot',
    reviewIcon: 'eye',
    accentBorderClass: 'border-ai',
    accentTextClass: 'text-ai',
    accentSliderClass: 'accent-ai',
    generationSliders: ['aiGen'],
    reviewSliders: ['skim'],
    showsDerivedValues: true,
  }),
})

export const LANE_ORDER = Object.freeze(Object.values(LANE_IDS))

// Labels are the sliders' accessible names. Ranges and defaults come only from engine.SLIDERS.
export const SLIDER_PRESENTATION = Object.freeze({
  humanGen: Object.freeze({
    label: 'Human generation (PRs/hr)',
    unit: ' PRs/hr',
    spokenUnit: 'PRs per hour',
  }),
  aiGen: Object.freeze({
    label: 'AI generation (PRs/hr)',
    unit: ' PRs/hr',
    spokenUnit: 'PRs per hour',
  }),
  prSize: Object.freeze({
    label: 'PR size (LOC, both lanes)',
    unit: ' LOC',
    spokenUnit: 'lines of code',
  }),
  reviewerSpeed: Object.freeze({
    label: 'Reviewer speed (LOC/hr, both lanes)',
    unit: ' LOC/hr',
    spokenUnit: 'lines of code per hour',
  }),
  skim: Object.freeze({
    label: 'AI skim multiplier',
    unit: '×',
    spokenUnit: 'times',
  }),
})
