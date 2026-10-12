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

// Type scale. These are the plan's minimums, so no class here may go smaller.
export const TYPE_CLASS = Object.freeze({
  headline: 'text-6xl font-bold',
  title: 'text-3xl font-bold',
  count: 'text-4xl font-bold',
  value: 'text-xl font-semibold',
  label: 'text-base',
})

// Colour classes shared by components outside any one lane (complete literals for Tailwind).
export const COLOR_CLASS = Object.freeze({
  // Blue is deliberately the Human accent. Dark text keeps the label above 4.5:1 on that blue.
  primaryButton: 'bg-human text-gray-950',
  secondaryButtonBorder: 'border-gray-500',
  neutralSliderAccent: 'accent-gray-300',
  warningText: 'text-warning',
  deployedText: 'text-deployed',
  mutedText: 'text-gray-300',
  faintText: 'text-gray-400',
  lanePanel: 'bg-white/5',
  tag: 'bg-white/10',
  idleBoxBorder: 'border-gray-600',
})

export const QUEUE_STATE = Object.freeze({ warning: 'warning', normal: 'normal' })

// Complete class literals per state, so Tailwind's scanner finds them.
export const QUEUE_STATE_CLASS = Object.freeze({
  [QUEUE_STATE.warning]: 'border-warning bg-warning/10',
  [QUEUE_STATE.normal]: COLOR_CLASS.idleBoxBorder,
})

// Tiles drawn per queue box before "+N more": a compact three or four rows of 12px tiles. The
// phone layout test (375 px and 320 px) guards that they fit. The bounds are in laneConfig.test.js.
export const TILE_CAPACITY = 48

// How many tiles to draw for `displayed` pending PRs, and how many PRs they do not cover.
export const tileLayout = (displayed, capacity) => ({
  tileCount: Math.min(displayed, capacity),
  overflowCount: Math.max(0, displayed - capacity),
})
