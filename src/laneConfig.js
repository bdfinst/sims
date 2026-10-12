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
    accentTileClass: 'bg-human',
    generationSliders: ['humanGen', 'prSize'],
    reviewSliders: ['reviewerSpeed'],
  }),
  [LANE_IDS.ai]: Object.freeze({
    label: 'AI',
    accent: 'purple',
    generationIcon: 'bot',
    reviewIcon: 'eye',
    accentBorderClass: 'border-ai',
    accentTextClass: 'text-ai',
    accentSliderClass: 'accent-ai',
    accentTileClass: 'bg-ai',
    generationSliders: ['aiGen'],
    reviewSliders: ['skim'],
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
  threshold: Object.freeze({
    label: 'Warning threshold',
    unit: ' PRs',
    spokenUnit: 'PRs',
  }),
})

export const QUEUE_STATE = Object.freeze({ warning: 'warning', normal: 'normal' })

// Complete class literals per state, so Tailwind's scanner finds them.
export const QUEUE_STATE_CLASS = Object.freeze({
  [QUEUE_STATE.warning]: 'border-warning bg-warning/10',
  [QUEUE_STATE.normal]: 'border-gray-600',
})

// Tiles drawn per queue box before "+N more". Tiles are 12px with 4px gaps, so a phone's
// 263px of box width holds 16 per row: 48 tiles take three rows, and 1280px takes three or fewer.
// It must be at least 22 (the AI queue after 1.2 s) and at most 98.
export const TILE_CAPACITY = 48
