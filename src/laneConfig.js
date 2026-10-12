// Presentation only. Numeric behavior lives in engine.js.
// Tailwind class strings must stay complete literals so the scanner finds them.

import {
  FAROS_MERGE_RATE_INCREASE_PCT,
  FAROS_PR_SIZE_INCREASE_PCT,
  LANE_IDS,
  LANE_MODELS,
  WORK_HOURS_PER_DAY,
  formatLocPerHour,
  formatMultiplier,
  formatPrSize,
  formatPrsPerDay,
} from './engine.js'

// Read-only values a lane shows under its sliders, from laneParams: `paramKey` is the laneParams
// field, `format` renders it, `prefix` (may be empty) precedes it and `note` follows it, and `area`
// is the column it sits in. Lane renders these with no lane-specific branching.
export const DERIVED_AREA = Object.freeze({ generation: 'generation', review: 'review' })
const DERIVED_NOTE = '(derived)'
const derivedSize = (note) =>
  Object.freeze({
    paramKey: 'size',
    area: DERIVED_AREA.generation,
    prefix: 'PR size',
    format: formatPrSize,
    note,
  })
const DERIVED_PRS_PER_DAY = Object.freeze({
  paramKey: 'prsPerDay',
  area: DERIVED_AREA.generation,
  prefix: '',
  format: formatPrsPerDay,
  note: DERIVED_NOTE,
})
const DERIVED_EFFECTIVE_SPEED = Object.freeze({
  paramKey: 'effSpeed',
  area: DERIVED_AREA.review,
  prefix: 'Effective speed',
  format: formatLocPerHour,
  note: DERIVED_NOTE,
})

// The plain text a lane shows for one derived field, e.g. "PR size 362 LOC (1.51× human)".
export const derivedFieldText = ({ paramKey, prefix, format, note }, params) =>
  [prefix, format(params[paramKey]), note].filter((part) => part !== '').join(' ')

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
    generationSliders: ['humanLocPerHour', 'humanPrsPerDay'],
    reviewSliders: ['reviewerSpeed'],
    derivedFields: [derivedSize(DERIVED_NOTE)],
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
    generationSliders: ['aiLocPerHour'],
    reviewSliders: ['skim'],
    derivedFields: [
      derivedSize(`(${formatMultiplier(LANE_MODELS[LANE_IDS.ai].sizeMultiplier)} human)`),
      DERIVED_PRS_PER_DAY,
      DERIVED_EFFECTIVE_SPEED,
    ],
  }),
})

export const LANE_ORDER = Object.freeze(Object.values(LANE_IDS))

// Model figures the tips quote come from engine.js. Research quotes (SmartBear 500 LOC/hour,
// LinearB 2×) are verbatim literals shared with research.js and pinned by laneConfig.test.js.
const TIP_FIGURES = Object.freeze({
  workHoursPerDay: WORK_HOURS_PER_DAY,
  prSizeIncreasePct: FAROS_PR_SIZE_INCREASE_PCT,
  prSizeMultiplier: LANE_MODELS[LANE_IDS.ai].sizeMultiplier,
  mergeRateIncreasePct: FAROS_MERGE_RATE_INCREASE_PCT,
})

// Each slider's info tip: a lead sentence naming what it controls and its unit, then the lanes it
// affects and any source. Research claims use only the spec's Panel wording.
export const sliderInfoTexts = ({
  workHoursPerDay,
  prSizeIncreasePct,
  prSizeMultiplier,
  mergeRateIncreasePct,
} = TIP_FIGURES) => ({
  humanLocPerHour: `How many lines of code the human lane writes, in LOC/hr. With Human PRs per day, it sets the human PR size. AI PRs are ${formatMultiplier(prSizeMultiplier)} that size (Faros: PR size +${prSizeIncreasePct}%).`,
  humanPrsPerDay: `How many PRs the human lane opens per ${workHoursPerDay}-hour work day, in PRs/day. Below 1, a PR spans more than one day. Human PR size = LOC/hr × ${workHoursPerDay} ÷ PRs/day.`,
  aiLocPerHour: `How many lines of code the AI lane generates, in LOC/hr. The AI queue grows once this exceeds the AI lane's effective review speed. Default: the human default scaled by Faros (PR size +${prSizeIncreasePct}%, PR merge rate +${mergeRateIncreasePct}%).`,
  reviewerSpeed:
    'How many lines of code a reviewer reads, in LOC/hr, in both lanes. Defect discovery drops significantly faster than 500 LOC/hour (SmartBear).',
  skim: 'How much faster reviewers read AI-generated code (×) in the AI lane: effective speed is reviewer speed × this value. AI PRs are reviewed 2× faster once picked up (LinearB).',
  threshold: 'A Pending Review box turns red when its count is above this many PRs, in both lanes.',
})

const SLIDER_INFO = sliderInfoTexts()

const TIP_LANES = Object.freeze({ both: 'both lanes', human: 'human lane', ai: 'AI lane' })

// Labels are the sliders' accessible names. Ranges and defaults come only from engine.SLIDERS.
// `info` is the slider's info tip; `unitName` and `lanes` are the unit and lanes the tip names.
export const SLIDER_PRESENTATION = Object.freeze({
  humanLocPerHour: Object.freeze({
    label: 'Human code written (LOC/hr)',
    unit: ' LOC/hr',
    spokenUnit: 'lines of code per hour',
    info: SLIDER_INFO.humanLocPerHour,
    unitName: 'LOC/hr',
    lanes: TIP_LANES.human,
  }),
  humanPrsPerDay: Object.freeze({
    label: 'Human PRs per day',
    unit: ' PRs/day',
    spokenUnit: 'PRs per day',
    info: SLIDER_INFO.humanPrsPerDay,
    unitName: 'PRs/day',
    lanes: TIP_LANES.human,
  }),
  aiLocPerHour: Object.freeze({
    label: 'AI code written (LOC/hr)',
    unit: ' LOC/hr',
    spokenUnit: 'lines of code per hour',
    info: SLIDER_INFO.aiLocPerHour,
    unitName: 'LOC/hr',
    lanes: TIP_LANES.ai,
  }),
  reviewerSpeed: Object.freeze({
    label: 'Reviewer speed (LOC/hr, both lanes)',
    unit: ' LOC/hr',
    spokenUnit: 'lines of code per hour',
    info: SLIDER_INFO.reviewerSpeed,
    unitName: 'LOC/hr',
    lanes: TIP_LANES.both,
  }),
  skim: Object.freeze({
    label: 'AI skim multiplier',
    unit: '×',
    spokenUnit: 'times',
    info: SLIDER_INFO.skim,
    unitName: '×',
    lanes: TIP_LANES.ai,
  }),
  threshold: Object.freeze({
    label: 'Warning threshold',
    unit: ' PRs',
    spokenUnit: 'PRs',
    info: SLIDER_INFO.threshold,
    unitName: 'PRs',
    lanes: TIP_LANES.both,
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
  link: 'text-sky-300 underline',
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
