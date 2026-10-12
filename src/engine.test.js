import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS,
  FAROS_MERGE_RATE_INCREASE_PCT,
  FAROS_MERGE_RATE_MULTIPLIER,
  FAROS_PR_SIZE_INCREASE_PCT,
  FAROS_PR_SIZE_MULTIPLIER,
  LANE_IDS,
  LANE_MODELS,
  MODEL_ASSUMPTIONS,
  NO_VALUE,
  SLIDERS,
  WORK_HOURS_PER_DAY,
  detection,
  displayedDeployed,
  displayedIncidents,
  displayedPending,
  emptyLane,
  floorShow,
  formatDefectsCaught,
  formatCount,
  formatElapsedHours,
  formatHeadlineRatio,
  formatIncidentsPerPr,
  formatLoc,
  formatLocPerHour,
  formatMultiplier,
  formatPct,
  formatPickupWaitHours,
  formatPrSize,
  formatPrsPerDay,
  humanPrSize,
  isOverThreshold,
  laneParams,
  sizeFactor,
  speedFactor,
  tick,
} from './engine.js'
import { shownCounts } from './testHelpers.js'

// Oracles in this file are literals taken from the plan's "Default arithmetic" (generation
// amendment), never computed from src: they must not move if a src constant is edited by mistake.

const HUMAN = LANE_IDS.human
const AI = LANE_IDS.ai

describe('laneParams at the default settings', () => {
  it('gives the Human lane 240 LOC PRs at 1 PR per day, 0.125 PR/hr, and the reviewer speed', () => {
    expect(laneParams(DEFAULT_SETTINGS, LANE_MODELS[HUMAN])).toEqual({
      gen: 0.125,
      size: 240,
      effSpeed: 300,
      prsPerDay: 1,
    })
  })

  it('gives the AI lane 362.4 LOC PRs, 1.17 PRs per day, and a skim-multiplied speed of 600', () => {
    const params = laneParams(DEFAULT_SETTINGS, LANE_MODELS[AI])
    expect(params.size).toBeCloseTo(362.4, 10)
    expect(params.gen).toBeCloseTo(0.14625, 5)
    expect(params.prsPerDay).toBeCloseTo(1.17, 2)
    expect(params.effSpeed).toBe(600)
  })
})

describe('laneParams after settings change', () => {
  it('halves both PR sizes and doubles the PRs per day when Human PRs per day goes to 2', () => {
    const settings = { ...DEFAULT_SETTINGS, humanPrsPerDay: 2 }
    expect(laneParams(settings, LANE_MODELS[HUMAN])).toMatchObject({ size: 120, prsPerDay: 2 })
    const ai = laneParams(settings, LANE_MODELS[AI])
    expect(ai.size).toBeCloseTo(181.2, 10)
    expect(ai.prsPerDay).toBeCloseTo(2.34, 2)
  })

  it('gives the AI lane an effective speed of 900 LOC/hr at skim 3', () => {
    const settings = { ...DEFAULT_SETTINGS, skim: 3 }
    expect(laneParams(settings, LANE_MODELS[AI]).effSpeed).toBe(900)
  })

  it('moves both PR sizes with Human code written: 50 LOC/hr gives 400 and 604', () => {
    const settings = { ...DEFAULT_SETTINGS, humanLocPerHour: 50 }
    expect(laneParams(settings, LANE_MODELS[HUMAN]).size).toBe(400)
    expect(laneParams(settings, LANE_MODELS[AI]).size).toBeCloseTo(604, 10)
  })

  it('changes only the AI PRs per day when AI code written goes to 2000: 44.15, sizes unchanged', () => {
    const settings = { ...DEFAULT_SETTINGS, aiLocPerHour: 2000 }
    const ai = laneParams(settings, LANE_MODELS[AI])
    expect(ai.prsPerDay).toBeCloseTo(44.15, 2)
    expect(ai.size).toBeCloseTo(362.4, 10)
    expect(laneParams(settings, LANE_MODELS[HUMAN])).toEqual(
      laneParams(DEFAULT_SETTINGS, LANE_MODELS[HUMAN]),
    )
  })

  it('ignores skim for the Human lane', () => {
    const settings = { ...DEFAULT_SETTINGS, skim: 3 }
    expect(laneParams(settings, LANE_MODELS[HUMAN]).effSpeed).toBe(300)
  })

  it.each([
    { humanPrsPerDay: 0.5, humanSize: 480, aiSize: 724.8, aiPrsPerDay: 0.585 },
    { humanPrsPerDay: 0.25, humanSize: 960, aiSize: 1449.6, aiPrsPerDay: 0.2925 },
  ])(
    'derives $humanSize and $aiSize LOC PRs at $humanPrsPerDay Human PRs per day',
    ({ humanPrsPerDay, humanSize, aiSize, aiPrsPerDay }) => {
      const settings = { ...DEFAULT_SETTINGS, humanPrsPerDay }
      expect(laneParams(settings, LANE_MODELS[HUMAN]).size).toBeCloseTo(humanSize, 10)
      const ai = laneParams(settings, LANE_MODELS[AI])
      expect(ai.size).toBeCloseTo(aiSize, 10)
      expect(ai.prsPerDay).toBeCloseTo(aiPrsPerDay, 3)
    },
  )

  it('derives 373.3 and 563.7 LOC PRs at 35 LOC/hr and 0.75 PRs per day, AI at 0.75 PRs per day', () => {
    const settings = { ...DEFAULT_SETTINGS, humanLocPerHour: 35, humanPrsPerDay: 0.75 }
    expect(laneParams(settings, LANE_MODELS[HUMAN]).size).toBeCloseTo(373.33, 2)
    const ai = laneParams(settings, LANE_MODELS[AI])
    expect(ai.size).toBeCloseTo(563.73, 2)
    expect(ai.prsPerDay).toBeCloseTo(0.75, 2)
  })
})

describe('LANE_MODELS', () => {
  it('describes each lane by its code-written setting, size multiplier, and whether skim applies', () => {
    expect(LANE_MODELS[HUMAN]).toEqual({
      locSetting: 'humanLocPerHour',
      sizeMultiplier: 1,
      skimApplies: false,
    })
    expect(LANE_MODELS[AI]).toEqual({
      locSetting: 'aiLocPerHour',
      sizeMultiplier: 1.51,
      skimApplies: true,
    })
  })

  it.each(Object.values(LANE_IDS))('points the %s lane at a setting that exists', (laneId) => {
    expect(Object.keys(SLIDERS)).toContain(LANE_MODELS[laneId].locSetting)
  })
})

describe('slider table', () => {
  it('defaults every setting to the spec State table value', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      humanLocPerHour: 30,
      humanPrsPerDay: 1,
      aiLocPerHour: 53,
      reviewerSpeed: 300,
      skim: 2,
      threshold: 15,
    })
  })

  it.each([
    { key: 'humanLocPerHour', min: 5, max: 200, step: 5, defaultValue: 30 },
    { key: 'humanPrsPerDay', min: 0.25, max: 4, step: 0.25, defaultValue: 1 },
    { key: 'aiLocPerHour', min: 5, max: 2000, step: 1, defaultValue: 53 },
    { key: 'reviewerSpeed', min: 100, max: 1000, step: 50, defaultValue: 300 },
    { key: 'skim', min: 1, max: 3, step: 0.5, defaultValue: 2 },
    { key: 'threshold', min: 5, max: 50, step: 1, defaultValue: 15 },
  ])('gives $key the range $min to $max in steps of $step', ({ key, ...slider }) => {
    expect(SLIDERS[key]).toEqual(slider)
  })

  it('keeps every default inside its own range', () => {
    Object.values(SLIDERS).forEach(({ min, max, defaultValue }) => {
      expect(defaultValue).toBeGreaterThanOrEqual(min)
      expect(defaultValue).toBeLessThanOrEqual(max)
    })
  })
})

const ONE_SECOND_IN_TICKS = 10
const TEN_SECONDS_IN_TICKS = 100
const TWENTY_FOUR_SECONDS_IN_TICKS = 240
const THIRTY_SECONDS_IN_TICKS = 300

// Rounds to `places` decimals, dropping float noise before an exact comparison.
const roundTo = (value, places) => Number(value.toFixed(places))

const runTicks = (lane, params, count) =>
  Array.from({ length: count }).reduce((current) => tick(current, params), lane)

// The lane after each of `count` ticks (the starting lane is not included).
const traceTicks = (lane, params, count) =>
  Array.from({ length: count })
    .reduce((lanes) => [...lanes, tick(lanes.at(-1), params)], [lane])
    .slice(1)

const paramsFor = (laneId, overrides = {}) =>
  laneParams({ ...DEFAULT_SETTINGS, ...overrides }, LANE_MODELS[laneId])

const defaultParams = (laneId) => paramsFor(laneId)

const afterDefaultRun = (laneId) =>
  runTicks(emptyLane(), defaultParams(laneId), TEN_SECONDS_IN_TICKS)

// Runs `laneId` at the defaults for `ticksBefore`, then under `overrides` for `ticksAfter` more.
const afterSettingChange = (laneId, { ticksBefore, overrides, ticksAfter }) =>
  runTicks(
    runTicks(emptyLane(), defaultParams(laneId), ticksBefore),
    paramsFor(laneId, overrides),
    ticksAfter,
  )

const lanesOf = ({ ai, human }) => ({ [AI]: ai, [HUMAN]: human })

const laneWithTotals = (deployedPrs, escapedDefects) => ({
  ...emptyLane(),
  deployedPrs,
  escapedDefects,
})

// AI code written 2000 with everything else at the defaults.
const BUSY_AI = { aiLocPerHour: 2000 }
// Human 5 LOC/hr, reviewers at 100 LOC/hr and no skim, AI 704 LOC/hr: a net +1 AI PR per tick.
const EXACT_AI = { humanLocPerHour: 5, reviewerSpeed: 100, skim: 1, aiLocPerHour: 704 }
// Human 200 LOC/hr at 4 PRs per day with reviewers at 100 LOC/hr.
const HUMAN_BACKLOG = { humanLocPerHour: 200, humanPrsPerDay: 4, reviewerSpeed: 100 }
// Cut AI generation to the minimum and review fast (effective speed 2000 LOC/hr).
const DRAINING = { aiLocPerHour: 5, reviewerSpeed: 1000 }

describe('tick at the default settings (AC7, 10 seconds)', () => {
  it('leaves both queues empty and deploys 1 PR each', () => {
    expect(shownCounts(afterDefaultRun(HUMAN))).toEqual([0, 1])
    expect(shownCounts(afterDefaultRun(AI))).toEqual([0, 1])
  })

  it('keeps 1.25 PRs deployed in the Human lane and 1.4625 in the AI lane', () => {
    expect(afterDefaultRun(HUMAN).deployedPrs).toBeCloseTo(1.25, 9)
    expect(afterDefaultRun(AI).deployedPrs).toBeCloseTo(1.4625, 4)
  })

  it('holds 0 pending LOC in both lanes', () => {
    expect(formatLoc(afterDefaultRun(HUMAN).pendingLoc)).toBe('0')
    expect(formatLoc(afterDefaultRun(AI).pendingLoc)).toBe('0')
  })
})

describe('deployed LOC', () => {
  it.each([
    { laneId: HUMAN, reviewedLoc: 300 },
    { laneId: AI, reviewedLoc: 530 },
  ])(
    'the $laneId lane has reviewed $reviewedLoc LOC after 10 seconds',
    ({ laneId, reviewedLoc }) => {
      expect(afterDefaultRun(laneId).deployedLoc).toBeCloseTo(reviewedLoc, 6)
    },
  )
})

describe('displayed counts', () => {
  it('floor the internal counts, absorbing float drift', () => {
    const lane = {
      ...emptyLane(),
      pendingPrs: 17.6,
      deployedPrs: 9.9999999999,
      escapedDefects: 106.84,
    }
    expect([displayedPending(lane), displayedDeployed(lane), displayedIncidents(lane)]).toEqual([
      17, 10, 106,
    ])
  })
})

describe('escape accrual at the default settings (10 seconds)', () => {
  // escaped = reviewed LOC x 0.02 x (1 - detection); Human detection 0.648, AI about 0.14996.
  it('lets 2.112 defects escape from the Human lane: 300 x 0.02 x 0.352', () => {
    expect(afterDefaultRun(HUMAN).escapedDefects).toBeCloseTo(2.112, 6)
  })

  it('lets 9.010 defects escape from the AI lane: 530 x 0.02 x 0.85004', () => {
    expect(afterDefaultRun(AI).escapedDefects).toBeCloseTo(9.0104, 3)
  })

  it('shows Incidents 2 and 9 once floored', () => {
    expect([
      displayedIncidents(afterDefaultRun(HUMAN)),
      displayedIncidents(afterDefaultRun(AI)),
    ]).toEqual([2, 9])
  })

  it('shows Incidents per PR 1.69 for the Human lane and 6.16 for the AI lane', () => {
    expect(formatIncidentsPerPr(afterDefaultRun(HUMAN))).toBe('1.69')
    expect(formatIncidentsPerPr(afterDefaultRun(AI))).toBe('6.16')
  })

  it('shows Defects caught 65% and 15% with a 0.0 h pickup wait in both lanes', () => {
    expect(formatDefectsCaught(defaultParams(HUMAN))).toBe('65%')
    expect(formatDefectsCaught(defaultParams(AI))).toBe('15%')
    expect(formatPickupWaitHours(afterDefaultRun(HUMAN), defaultParams(HUMAN))).toBe('0.0')
    expect(formatPickupWaitHours(afterDefaultRun(AI), defaultParams(AI))).toBe('0.0')
  })
})

describe('a PR counts as deployed only when fully reviewed', () => {
  it.each([
    { ticks: 79, deployed: 0, internal: 0.9875 },
    { ticks: 80, deployed: 1, internal: 1 },
  ])(
    'shows Human Deployed $deployed after $ticks ticks (internal $internal)',
    ({ ticks, deployed, internal }) => {
      const lane = runTicks(emptyLane(), defaultParams(HUMAN), ticks)
      expect(displayedDeployed(lane)).toBe(deployed)
      expect(lane.deployedPrs).toBeCloseTo(internal, 9)
    },
  )

  it('shows Incidents per PR only once the first whole PR is deployed (tick 80: 1.69)', () => {
    const at79 = runTicks(emptyLane(), defaultParams(HUMAN), 79)
    const at80 = runTicks(emptyLane(), defaultParams(HUMAN), 80)
    expect([formatIncidentsPerPr(at79), formatIncidentsPerPr(at80)]).toEqual([NO_VALUE, '1.69'])
  })
})

describe('formatIncidentsPerPr', () => {
  it('divides AI incidents by internal Deployed (9.0104 / 1.4625 = 6.16, not 9 / 1 = 9.00)', () => {
    expect(formatIncidentsPerPr(afterDefaultRun(AI))).toBe('6.16')
  })

  it('divides escaped defects by deployed PRs: 107 over 15 gives 7.13', () => {
    expect(formatIncidentsPerPr(laneWithTotals(15, 107))).toBe('7.13')
  })

  it('is blank while the displayed Deployed is 0 (0.9999 PRs)', () => {
    expect(formatIncidentsPerPr(laneWithTotals(0.9999, 1.755))).toBe(NO_VALUE)
  })

  it('shows a value from exactly 1 deployed PR (displayed Deployed 1)', () => {
    expect(formatIncidentsPerPr(laneWithTotals(1, 1.95))).toBe('1.95')
  })

  it('treats float drift just under 1 as 1 deployed PR', () => {
    expect(formatIncidentsPerPr(laneWithTotals(0.9999999999999999, 1.95))).toBe('1.95')
  })

  it('is blank for an empty lane, never NaN or Infinity', () => {
    expect(formatIncidentsPerPr(emptyLane())).toBe(NO_VALUE)
  })
})

describe('formatHeadlineRatio', () => {
  it('is the AI over Human incidents per PR: 3.65x at the defaults', () => {
    expect(
      formatHeadlineRatio(
        lanesOf({
          ai: afterDefaultRun(AI),
          human: afterDefaultRun(HUMAN),
        }),
      ),
    ).toBe('3.65×')
  })

  it('is blank until the Human lane displays Deployed 1 (tick 79)', () => {
    expect(
      formatHeadlineRatio(
        lanesOf({
          ai: afterDefaultRun(AI),
          human: runTicks(emptyLane(), defaultParams(HUMAN), 79),
        }),
      ),
    ).toBe(NO_VALUE)
  })

  it('is blank while the Human lane has shipped less than one whole PR (0.9 deployed)', () => {
    expect(
      formatHeadlineRatio(lanesOf({ ai: laneWithTotals(5, 30), human: laneWithTotals(0.9, 1.7) })),
    ).toBe(NO_VALUE)
  })

  it('is blank until the AI lane displays Deployed 1', () => {
    expect(
      formatHeadlineRatio(lanesOf({ ai: laneWithTotals(0.9, 6), human: laneWithTotals(5, 10) })),
    ).toBe(NO_VALUE)
  })

  it('is blank when the Human lane has no incidents yet (the ratio would be Infinity)', () => {
    expect(
      formatHeadlineRatio(lanesOf({ ai: laneWithTotals(5, 30), human: laneWithTotals(5, 0) })),
    ).toBe(NO_VALUE)
  })

  it('is blank when neither lane has incidents (the ratio would be NaN)', () => {
    expect(
      formatHeadlineRatio(lanesOf({ ai: laneWithTotals(5, 0), human: laneWithTotals(5, 0) })),
    ).toBe(NO_VALUE)
  })
})

describe('formatPickupWaitHours', () => {
  it.each([
    { pendingLoc: 69600, effSpeed: 600, shown: '116.0' },
    { pendingLoc: 0, effSpeed: 300, shown: '0.0' },
    { pendingLoc: 4400, effSpeed: 300, shown: '14.7' },
  ])(
    'shows $shown h for $pendingLoc LOC at $effSpeed LOC/hr',
    ({ pendingLoc, effSpeed, shown }) => {
      expect(formatPickupWaitHours({ ...emptyLane(), pendingLoc }, { effSpeed })).toBe(shown)
    },
  )
})

describe('mid-run changes from the defaults at 1 second (AC7c)', () => {
  // Hand-derived from the spec's curves: escape per tick = reviewed LOC x 0.02 x (1 - detection).
  it.each([
    {
      change: 'Human PRs per day 0.25 (PR size 960)',
      overrides: { humanPrsPerDay: 0.25 },
      caught: '4%',
      escapedOnNextTick: 0.0576, // 3 LOC x 0.02 x 0.96
      incidents: 5, // 5.395
      deployed: 0, // 0.406
      incidentsPerPr: NO_VALUE,
    },
    {
      change: 'Reviewer speed 900',
      overrides: { reviewerSpeed: 900 },
      caught: '18%',
      escapedOnNextTick: 0.0491136, // 3 LOC x 0.02 x (1 - 0.18144)
      incidents: 4, // 4.631
      deployed: 1,
      incidentsPerPr: '3.71',
    },
    {
      change: 'Human code written 50 (PR size 400)',
      overrides: { humanLocPerHour: 50 },
      caught: '4%',
      escapedOnNextTick: 0.096, // 5 LOC x 0.02 x 0.96
      incidents: 8, // 8.851
      deployed: 1,
      incidentsPerPr: '7.08',
    },
  ])(
    '$change: next tick catches $caught, and 10 seconds show Incidents $incidents',
    ({ overrides, caught, escapedOnNextTick, incidents, deployed, incidentsPerPr }) => {
      const afterOneSecond = runTicks(emptyLane(), defaultParams(HUMAN), ONE_SECOND_IN_TICKS)
      const params = paramsFor(HUMAN, overrides)
      const nextTick = tick(afterOneSecond, params)

      expect(formatDefectsCaught(params)).toBe(caught)
      expect(nextTick.escapedDefects - afterOneSecond.escapedDefects).toBeCloseTo(
        escapedOnNextTick,
        9,
      )

      const human = afterSettingChange(HUMAN, {
        ticksBefore: ONE_SECOND_IN_TICKS,
        overrides,
        ticksAfter: TEN_SECONDS_IN_TICKS - ONE_SECOND_IN_TICKS,
      })
      expect([displayedIncidents(human), displayedDeployed(human)]).toEqual([incidents, deployed])
      expect(formatIncidentsPerPr(human)).toBe(incidentsPerPr)
    },
  )

  it('leaves AI PR size, detection, and escapes per reviewed LOC unchanged by AI code written', () => {
    // 15% caught: 0.8 x sizeFactor(362.4) x speedFactor(600) = 0.8 x 0.2286 x 0.82 = 0.14996.
    // Each reviewed LOC lets 0.02 x (1 - 0.14996) = 0.0170008 defects escape.
    const escapedPerReviewedLoc = (params) => {
      const lane = tick(emptyLane(), params)
      return lane.escapedDefects / lane.deployedLoc
    }
    for (const aiLocPerHour of [53, 2000]) {
      const params = paramsFor(AI, { aiLocPerHour })
      expect(params.size, `size at ${aiLocPerHour}`).toBeCloseTo(362.4, 10)
      expect(detection(params.size, params.effSpeed), `detection at ${aiLocPerHour}`).toBeCloseTo(
        0.14996,
        5,
      )
      expect(escapedPerReviewedLoc(params), `escapes at ${aiLocPerHour}`).toBeCloseTo(0.0170008, 6)
    }
  })

  it('keeps 0.406 PRs deployed and 5.395 defects escaped after the 0.25 PRs per day change', () => {
    const human = afterSettingChange(HUMAN, {
      ticksBefore: ONE_SECOND_IN_TICKS,
      overrides: { humanPrsPerDay: 0.25 },
      ticksAfter: TEN_SECONDS_IN_TICKS - ONE_SECOND_IN_TICKS,
    })
    expect(human.deployedPrs).toBeCloseTo(0.40625, 5)
    expect(human.escapedDefects).toBeCloseTo(5.3952, 3)
  })

  it('shows Human Incidents 9 and 7.68 per PR when Human code written is 50 from the start', () => {
    const human = runTicks(
      emptyLane(),
      paramsFor(HUMAN, { humanLocPerHour: 50 }),
      TEN_SECONDS_IN_TICKS,
    )
    expect([shownCounts(human), displayedIncidents(human), formatIncidentsPerPr(human)]).toEqual([
      [0, 1],
      9,
      '7.68',
    ])
  })
})

describe('the busy AI lane (AI code written 2000)', () => {
  const busyTrace = traceTicks(emptyLane(), paramsFor(AI, BUSY_AI), THIRTY_SECONDS_IN_TICKS)
  const at = (seconds) => busyTrace[seconds * ONE_SECOND_IN_TICKS - 1]

  it('gains 0.38631 pending PR per tick: 3.863, 7.726, and 11.589 after 1, 2, and 3 seconds', () => {
    expect(at(1).pendingPrs).toBeCloseTo(3.863, 3)
    expect(at(2).pendingPrs).toBeCloseTo(7.726, 3)
    expect(at(3).pendingPrs).toBeCloseTo(11.589, 3)
  })

  it.each([
    { ticks: 10, shown: 3 },
    { ticks: 20, shown: 7 },
    { ticks: 30, shown: 11 },
  ])('shows Pending Review $shown after $ticks ticks', ({ ticks, shown }) => {
    expect(displayedPending(busyTrace[ticks - 1])).toBe(shown)
  })

  it.each([
    { ticks: 38, shown: 14, internal: 14.68 },
    { ticks: 39, shown: 15, internal: 15.066 },
    { ticks: 42, shown: 16, internal: 16.225 },
    { ticks: 50, shown: 19, internal: 19.316 },
    { ticks: 57, shown: 22, internal: 22.02 },
    { ticks: 60, shown: 23, internal: 23.179 },
    { ticks: 100, shown: 38, internal: 38.631 },
    { ticks: 300, shown: 115, internal: 115.894 },
  ])(
    'shows Pending Review $shown (internal $internal) after $ticks ticks',
    ({ ticks, shown, internal }) => {
      const lane = busyTrace[ticks - 1]
      expect(displayedPending(lane)).toBe(shown)
      expect(lane.pendingPrs).toBeCloseTo(internal, 2)
    },
  )

  it.each([
    { ticks: 10, shown: 1, internal: 1.656 },
    { ticks: 30, shown: 4, internal: 4.967 },
  ])('shows Deployed $shown after $ticks ticks', ({ ticks, shown, internal }) => {
    const lane = busyTrace[ticks - 1]
    expect(displayedDeployed(lane)).toBe(shown)
    expect(lane.deployedPrs).toBeCloseTo(internal, 3)
  })

  it('holds 2,800 pending LOC (200 generated minus 60 reviewed per tick) after 2 seconds', () => {
    expect(formatLoc(at(2).pendingLoc)).toBe('2,800')
  })

  it('leaves Defects caught at 15% (AI) and 65% (Human) however much code the AI writes', () => {
    expect(formatDefectsCaught(paramsFor(AI, BUSY_AI))).toBe('15%')
    expect(formatDefectsCaught(paramsFor(HUMAN, BUSY_AI))).toBe('65%')
  })
})

describe('AI code written against the AI lane effective review speed (AC7d)', () => {
  const AI_AT_1000 = paramsFor(AI, { aiLocPerHour: 1000 })
  const FIFTEEN_SECONDS_IN_TICKS = 150

  it('adds exactly 40 pending LOC per tick at 1,000 LOC/hr: 40, 80, ... 6,000 at 15 seconds', () => {
    const trace = traceTicks(emptyLane(), AI_AT_1000, FIFTEEN_SECONDS_IN_TICKS)
    const pendingLoc = trace.map((lane) => roundTo(lane.pendingLoc, 6))
    expect(pendingLoc).toEqual(
      Array.from({ length: FIFTEEN_SECONDS_IN_TICKS }, (_, i) => 40 * (i + 1)),
    )
    expect(formatLoc(trace.at(-1).pendingLoc)).toBe('6,000')
  })

  it('shows a strictly increasing Pending LOC at 1,000 LOC/hr, tick after tick', () => {
    const shown = traceTicks(emptyLane(), AI_AT_1000, FIFTEEN_SECONDS_IN_TICKS).map((lane) =>
      floorShow(lane.pendingLoc),
    )
    const notIncreasing = shown.filter((loc, index) => index > 0 && loc <= shown[index - 1])
    expect(notIncreasing).toEqual([])
  })

  it('shows Pending Review 11 at 10 seconds and 16 (16.556) at 15 seconds, first reaching 16 at tick 145', () => {
    const trace = traceTicks(emptyLane(), AI_AT_1000, FIFTEEN_SECONDS_IN_TICKS)
    expect(displayedPending(trace[TEN_SECONDS_IN_TICKS - 1])).toBe(11)
    expect(trace[FIFTEEN_SECONDS_IN_TICKS - 1].pendingPrs).toBeCloseTo(16.556, 3)
    expect(displayedPending(trace[143])).toBe(15)
    expect(displayedPending(trace[144])).toBe(16)
  })

  describe('at 600 LOC/hr, equal to the effective review speed', () => {
    const trace = traceTicks(
      emptyLane(),
      paramsFor(AI, { aiLocPerHour: 600 }),
      THIRTY_SECONDS_IN_TICKS,
    )

    it('keeps the displayed queue at 0 for 30 seconds', () => {
      expect(trace.map((lane) => displayedPending(lane))).toEqual(
        Array(THIRTY_SECONDS_IN_TICKS).fill(0),
      )
    })

    it('keeps the displayed Pending LOC at 0 for 30 seconds', () => {
      expect(trace.map((lane) => formatLoc(lane.pendingLoc))).toEqual(
        Array(THIRTY_SECONDS_IN_TICKS).fill('0'),
      )
    })

    it('deploys 16 PRs (16.556) in 10 seconds', () => {
      expect(displayedDeployed(trace[TEN_SECONDS_IN_TICKS - 1])).toBe(16)
      expect(trace[TEN_SECONDS_IN_TICKS - 1].deployedPrs).toBeCloseTo(16.556, 3)
    })
  })

  const FIVE_SECONDS_IN_TICKS = 50

  // The change in internal pending LOC over each of `count` ticks from an empty lane, to 9 places.
  const pendingLocGrowthPerTick = (params, count) =>
    traceTicks(emptyLane(), params, count).map((lane, index, trace) =>
      roundTo(lane.pendingLoc - (index === 0 ? 0 : trace[index - 1].pendingLoc), 9),
    )

  it('grows the internal pending LOC by (code written - effective speed) x 0.1 per tick at 601 LOC/hr', () => {
    expect(
      pendingLocGrowthPerTick(paramsFor(AI, { aiLocPerHour: 601 }), FIVE_SECONDS_IN_TICKS),
    ).toEqual(Array(FIVE_SECONDS_IN_TICKS).fill(0.1))
  })

  // AC7d: growth per tick is (code written - effective speed) x 0.1, whatever the capacity is.
  it.each([
    { aiLocPerHour: 602, capacity: 600, overrides: {}, growth: 0.2 },
    { aiLocPerHour: 101, capacity: 100, overrides: { reviewerSpeed: 100, skim: 1 }, growth: 0.1 },
    { aiLocPerHour: 1001, capacity: 1000, overrides: { reviewerSpeed: 500, skim: 2 }, growth: 0.1 },
  ])(
    'grows the internal pending LOC by $growth per tick at $aiLocPerHour LOC/hr, just above an effective speed of $capacity',
    ({ aiLocPerHour, overrides, growth }) => {
      expect(
        pendingLocGrowthPerTick(
          paramsFor(AI, { ...overrides, aiLocPerHour }),
          FIVE_SECONDS_IN_TICKS,
        ),
      ).toEqual(Array(FIVE_SECONDS_IN_TICKS).fill(growth))
    },
  )

  it('accumulates 5 pending LOC in 5 seconds at 601 LOC/hr', () => {
    const lane = runTicks(emptyLane(), paramsFor(AI, { aiLocPerHour: 601 }), FIVE_SECONDS_IN_TICKS)
    expect(lane.pendingLoc).toBeCloseTo(5, 6)
  })
})

describe('the exact AI preset: a net of +1 pending PR per tick', () => {
  it('makes the human PR 40 LOC and the AI PR 60.4 LOC', () => {
    expect(paramsFor(HUMAN, EXACT_AI).size).toBe(40)
    expect(paramsFor(AI, EXACT_AI).size).toBeCloseTo(60.4, 10)
  })

  it('shows Pending Review n after n ticks for every n up to 100', () => {
    const shown = traceTicks(emptyLane(), paramsFor(AI, EXACT_AI), 100).map((lane) =>
      displayedPending(lane),
    )
    expect(shown).toEqual(Array.from({ length: 100 }, (_, index) => index + 1))
  })
})

describe('the human backlog preset: a human queue that grows one PR every 4 seconds', () => {
  it('makes the human PR 400 LOC, so Defects caught is 4%', () => {
    expect(paramsFor(HUMAN, HUMAN_BACKLOG).size).toBe(400)
    expect(formatDefectsCaught(paramsFor(HUMAN, HUMAN_BACKLOG))).toBe('4%')
  })

  it('shows Human Pending Review 1 at 4 seconds and 6 at 24 seconds', () => {
    const trace = traceTicks(
      emptyLane(),
      paramsFor(HUMAN, HUMAN_BACKLOG),
      TWENTY_FOUR_SECONDS_IN_TICKS,
    )
    expect(displayedPending(trace[39])).toBe(1)
    expect(displayedPending(trace[239])).toBe(6)
  })

  it('shows AI Pending Review 71 at 24 seconds when AI code written is 2000 (effective speed 200)', () => {
    const ai = runTicks(
      emptyLane(),
      paramsFor(AI, { ...HUMAN_BACKLOG, ...BUSY_AI }),
      TWENTY_FOUR_SECONDS_IN_TICKS,
    )
    expect(displayedPending(ai)).toBe(71)
  })
})

describe('draining a backlog', () => {
  const afterBusyTicks = (ticks) => runTicks(emptyLane(), paramsFor(AI, BUSY_AI), ticks)
  const drainingParams = paramsFor(AI, DRAINING)

  describe('from 7.726 pending PRs at 2000 LOC/hr effective speed', () => {
    const pending = traceTicks(afterBusyTicks(20), drainingParams, 30).map(
      (lane) => lane.pendingPrs,
    )

    it('starts from a displayed 7', () => {
      expect(displayedPending(afterBusyTicks(20))).toBe(7)
    })

    it('shows 1 after 12 ticks and 0 after 13, while 0.57 PR is still queued', () => {
      expect([floorShow(pending[11]), floorShow(pending[12])]).toEqual([1, 0])
      expect(pending[12]).toBeGreaterThan(0)
    })

    it('is empty by tick 15', () => {
      expect(pending[14]).toBe(0)
    })

    it('never goes below 0', () => {
      expect(Math.min(...pending)).toBeGreaterThanOrEqual(0)
    })
  })

  describe('from 19.316 pending PRs, removing 0.551 PR per tick', () => {
    const pending = traceTicks(afterBusyTicks(50), drainingParams, 7).map((lane) => lane.pendingPrs)

    it('passes through 18.77, 18.21, 17.66, 17.11, 16.56, 16.01 and 15.46', () => {
      expect(pending.map((value) => roundTo(value, 2))).toEqual([
        18.77, 18.21, 17.66, 17.11, 16.56, 16.01, 15.46,
      ])
    })

    it('shows 16 after 0.6 s and 15 after 0.7 s', () => {
      expect([floorShow(pending[5]), floorShow(pending[6])]).toEqual([16, 15])
    })
  })

  it('shows no pickup wait and Defects caught 2% once drained (6 seconds)', () => {
    const drained = runTicks(afterBusyTicks(20), drainingParams, 60)
    expect(displayedPending(drained)).toBe(0)
    expect(formatPickupWaitHours(drained, drainingParams)).toBe('0.0')
    expect(formatDefectsCaught(drainingParams)).toBe('2%')
  })
})

describe('queued PRs keep their size when the PR size changes', () => {
  it('goes from Pending Review 7 and 2,800 LOC to 9 and 4,200 LOC after 1 second at 0.5 Human PRs per day', () => {
    const queued = runTicks(emptyLane(), paramsFor(AI, BUSY_AI), 20)
    expect([displayedPending(queued), formatLoc(queued.pendingLoc)]).toEqual([7, '2,800'])

    const resized = runTicks(
      queued,
      paramsFor(AI, { ...BUSY_AI, humanPrsPerDay: 0.5 }),
      ONE_SECOND_IN_TICKS,
    )

    expect([displayedPending(resized), formatLoc(resized.pendingLoc)]).toEqual([9, '4,200'])
  })
})

describe('tick guards', () => {
  it('empties a queue whose review capacity exceeds it', () => {
    const backlog = { ...emptyLane(), pendingPrs: 0.5, pendingLoc: 125 }
    const lane = tick(backlog, { gen: 0, size: 250, effSpeed: 1500 })
    expect([lane.pendingPrs, lane.pendingLoc]).toEqual([0, 0])
  })

  it('clamps float drift so Pending PRs never goes below zero', () => {
    // (0.2 * 10.200000000000001) / 10.200000000000001 exceeds 0.2 by one rounding step,
    // so subtracting the reviewed share would leave about -2.8e-17 without the clamp.
    const drifting = { ...emptyLane(), pendingPrs: 0.2, pendingLoc: 10.200000000000001 }
    const lane = tick(drifting, { gen: 0, size: 250, effSpeed: 1000 })
    expect(lane.pendingPrs).toBe(0)
  })

  it('stays finite on an empty queue with no generation', () => {
    const lane = tick(emptyLane(), { gen: 0, size: 250, effSpeed: 300 })
    expect(lane).toEqual(emptyLane())
  })

  it('does not mutate the lane it was given', () => {
    const before = emptyLane()
    tick(before, defaultParams(LANE_IDS.ai))
    expect(before).toEqual(emptyLane())
  })
})

describe('floorShow', () => {
  it.each([
    { value: 9.9999999999, shown: 10 },
    { value: 0.9, shown: 0 },
    { value: 0, shown: 0 },
  ])('shows $shown for $value', ({ value, shown }) => {
    expect(floorShow(value)).toBe(shown)
  })
})

describe('formatElapsedHours', () => {
  it.each([
    { ticks: 0, shown: '0.0' },
    { ticks: 30, shown: '3.0' },
    { ticks: 100, shown: '10.0' },
  ])('shows $shown for $ticks ticks', ({ ticks, shown }) => {
    expect(formatElapsedHours(ticks)).toBe(shown)
  })
})

describe('sizeFactor', () => {
  it.each([
    { size: 50, factor: 1 },
    { size: 200, factor: 1 },
    { size: 300, factor: 0.525 },
    { size: 400, factor: 0.05 },
    { size: 1000, factor: 0.05 },
  ])('is $factor for a $size LOC PR', ({ size, factor }) => {
    expect(sizeFactor(size)).toBeCloseTo(factor, 10)
  })

  it('starts falling just past the knee and stops just before the wall', () => {
    expect(sizeFactor(201)).toBeLessThan(1)
    expect(sizeFactor(399)).toBeGreaterThan(0.05)
  })
})

describe('speedFactor', () => {
  it.each([
    { speed: 100, factor: 1 },
    { speed: 500, factor: 1 },
    { speed: 750, factor: 0.55 },
    { speed: 1000, factor: 0.1 },
    { speed: 5000, factor: 0.1 },
  ])('is $factor at $speed LOC/hr', ({ speed, factor }) => {
    expect(speedFactor(speed)).toBeCloseTo(factor, 10)
  })

  it('starts falling just past the knee and stops just before the wall', () => {
    expect(speedFactor(501)).toBeLessThan(1)
    expect(speedFactor(999)).toBeGreaterThan(0.1)
  })
})

describe('detection', () => {
  // Literals worked out by hand from the spec's curve, not from the code's helpers:
  // size 300 -> 1 - 0.95 x (300 - 200) / 200 = 0.525; speed 750 -> 1 - 0.9 x (750 - 500) / 500 = 0.55.
  it('multiplies the 0.8 base by both factors: PR size 300 at 750 LOC/hr is 0.8 x 0.525 x 0.55 = 0.231', () => {
    expect(detection(300, 750)).toBeCloseTo(0.231, 12)
  })

  // Default arithmetic: Human 240 LOC at 300 LOC/hr = 0.8 x 0.81 x 1; AI 362.4 LOC at 600 LOC/hr
  // = 0.8 x 0.2286 x 0.82.
  it.each([
    { lane: 'Human', size: 240, speed: 300, expected: 0.648 },
    { lane: 'AI', size: 362.4, speed: 600, expected: 0.1499616 },
  ])('is $expected for the $lane lane at the defaults', ({ size, speed, expected }) => {
    expect(detection(size, speed)).toBeCloseTo(expected, 12)
  })
})

describe('Defects caught for a lane as displayed', () => {
  const caught = (laneId, overrides) => formatDefectsCaught(paramsFor(laneId, overrides))

  it.each([
    { humanLocPerHour: 25, humanPrsPerDay: 4, size: 50, shown: '80%' },
    { humanLocPerHour: 25, humanPrsPerDay: 1, size: 200, shown: '80%' },
    { humanLocPerHour: 75, humanPrsPerDay: 2, size: 300, shown: '42%' },
    { humanLocPerHour: 50, humanPrsPerDay: 1, size: 400, shown: '4%' },
    { humanLocPerHour: 125, humanPrsPerDay: 1, size: 1000, shown: '4%' },
  ])(
    'Human at PR size $size ($humanLocPerHour LOC/hr, $humanPrsPerDay PRs/day) catches $shown',
    ({ humanLocPerHour, humanPrsPerDay, size, shown }) => {
      expect(paramsFor(HUMAN, { humanLocPerHour, humanPrsPerDay }).size).toBe(size)
      expect(caught(HUMAN, { humanLocPerHour, humanPrsPerDay })).toBe(shown)
    },
  )

  it.each([
    { reviewerSpeed: 500, shown: '80%' },
    { reviewerSpeed: 750, shown: '44%' },
    { reviewerSpeed: 900, shown: '22%' },
    { reviewerSpeed: 1000, shown: '8%' },
  ])(
    'Human at PR size 200 and $reviewerSpeed LOC/hr catches $shown',
    ({ reviewerSpeed, shown }) => {
      expect(caught(HUMAN, { humanLocPerHour: 25, reviewerSpeed })).toBe(shown)
    },
  )

  it.each([
    { laneId: HUMAN, shown: '65%' },
    { laneId: AI, shown: '15%' },
  ])('catches $shown in the $laneId lane at the defaults', ({ laneId, shown }) => {
    expect(caught(laneId, {})).toBe(shown)
  })

  it.each([
    { skim: 3, shown: '5%' },
    { skim: 1, shown: '18%' },
  ])('AI at skim $skim catches $shown', ({ skim, shown }) => {
    expect(caught(AI, { skim })).toBe(shown)
  })

  it('catches 4% in the AI lane of the human backlog preset (the AI PR follows the human PR: 604 LOC)', () => {
    expect(caught(AI, HUMAN_BACKLOG)).toBe('4%')
  })

  it('shows 6% for a drained Human queue (PR size 240 at 1000 LOC/hr)', () => {
    expect(caught(HUMAN, { reviewerSpeed: 1000 })).toBe('6%')
  })
})

describe('formatPct', () => {
  it.each([
    { share: 0.61, shown: '61%' },
    { share: 0.0346, shown: '3%' },
    { share: 0.125, shown: '13%' },
    { share: 0, shown: '0%' },
  ])('shows $shown for $share', ({ share, shown }) => {
    expect(formatPct(share)).toBe(shown)
  })
})

describe('formatLoc', () => {
  it.each([
    { loc: 0, shown: '0' },
    { loc: 999.9999999999, shown: '1,000' },
    { loc: 69600, shown: '69,600' },
    { loc: 4400.4, shown: '4,400' },
  ])('shows $shown for $loc', ({ loc, shown }) => {
    expect(formatLoc(loc)).toBe(shown)
  })
})

describe('isOverThreshold', () => {
  const THRESHOLD = 15
  const laneWithPending = (pendingPrs) => ({ ...emptyLane(), pendingPrs })

  it.each([
    { threshold: THRESHOLD, displayed: THRESHOLD - 1, isOver: false },
    { threshold: THRESHOLD, displayed: THRESHOLD, isOver: false },
    { threshold: THRESHOLD, displayed: THRESHOLD + 1, isOver: true },
  ])(
    'is $isOver when $displayed PRs are pending against a threshold of $threshold',
    ({ threshold, displayed, isOver }) => {
      expect(isOverThreshold(displayed, threshold)).toBe(isOver)
    },
  )

  it.each([
    { threshold: THRESHOLD, internal: 15.84, shown: 15, isOver: false },
    { threshold: THRESHOLD, internal: 16.72, shown: 16, isOver: true },
  ])(
    'judges the displayed count: $internal PRs (shown as $shown) against $threshold is $isOver',
    ({ threshold, internal, shown, isOver }) => {
      expect(displayedPending(laneWithPending(internal))).toBe(shown)
      expect(isOverThreshold(displayedPending(laneWithPending(internal)), threshold)).toBe(isOver)
    },
  )
})

describe('formatCount', () => {
  it('groups thousands with commas', () => {
    expect(formatCount(1000)).toBe('1,000')
    expect(formatCount(999)).toBe('999')
  })
})

describe('MODEL_ASSUMPTIONS', () => {
  it('reports the model constants the research panel discloses', () => {
    expect(MODEL_ASSUMPTIONS).toEqual({
      defectsPerKloc: 20,
      baseDetection: 0.8,
      sizeFloor: 0.05,
      speedFloor: 0.1,
      sizeKnee: 200,
      sizeWall: 400,
      speedKnee: 500,
      speedWall: 1000,
      humanDefaultLocPerHour: 30,
      humanDefaultPrsPerDay: 1,
      aiSizeMultiplier: 1.51,
      aiPrsPerDayRatio: expect.closeTo(53 / 45.3, 10),
    })
  })
})

// Oracles here are literals on purpose: they must not move if a src constant is edited by mistake.
describe('generation constants', () => {
  it('works an 8-hour day and takes the Faros increases as 51% and 16.2%', () => {
    expect(WORK_HOURS_PER_DAY).toBe(8)
    expect(FAROS_PR_SIZE_INCREASE_PCT).toBe(51)
    expect(FAROS_MERGE_RATE_INCREASE_PCT).toBe(16.2)
  })

  it('derives the multipliers as exactly 1.51 and 1.162', () => {
    expect(FAROS_PR_SIZE_MULTIPLIER).toBe(1.51)
    expect(FAROS_MERGE_RATE_MULTIPLIER).toBe(1.162)
  })

  it('derives the AI code-written default (53 LOC/hr) from 30 LOC/hr and both multipliers', () => {
    expect(Math.round(30 * FAROS_PR_SIZE_MULTIPLIER * FAROS_MERGE_RATE_MULTIPLIER)).toBe(53)
  })
})

describe('humanPrSize', () => {
  it.each([
    { humanLocPerHour: 30, humanPrsPerDay: 1, size: 240 },
    { humanLocPerHour: 30, humanPrsPerDay: 0.5, size: 480 },
    { humanLocPerHour: 30, humanPrsPerDay: 0.25, size: 960 },
    { humanLocPerHour: 35, humanPrsPerDay: 0.75, size: 373.33 },
  ])(
    'is $size LOC at $humanLocPerHour LOC/hr and $humanPrsPerDay PRs/day',
    ({ humanLocPerHour, humanPrsPerDay, size }) => {
      expect(humanPrSize({ humanLocPerHour, humanPrsPerDay })).toBeCloseTo(size, 2)
    },
  )
})

describe('formatPrSize', () => {
  it.each([
    { loc: 240, shown: '240 LOC' },
    { loc: 362.4, shown: '362 LOC' },
    { loc: 373.3333, shown: '373 LOC' },
    { loc: 563.7, shown: '564 LOC' },
    { loc: 1449.6, shown: '1,450 LOC' },
  ])('shows $shown for $loc', ({ loc, shown }) => {
    expect(formatPrSize(loc)).toBe(shown)
  })
})

describe('formatPrsPerDay', () => {
  // Inputs are the model's own values: 53 x 8 / (PR size x 1.51) at the defaults, at 0.5 and 0.25
  // Human PRs per day, and 2000 x 8 / (240 x 1.51).
  it.each([
    { prsPerDay: 1, shown: '1.00 PRs/day' },
    { prsPerDay: 1.1699779249448123, shown: '1.17 PRs/day' },
    { prsPerDay: 0.5849889624724062, shown: '0.58 PRs/day' },
    { prsPerDay: 0.2924944812362031, shown: '0.29 PRs/day' },
    { prsPerDay: 44.15011037527594, shown: '44.15 PRs/day' },
  ])('shows $shown for $prsPerDay', ({ prsPerDay, shown }) => {
    expect(formatPrsPerDay(prsPerDay)).toBe(shown)
  })

  it('groups thousands and keeps two decimals for a large value: 1,059.60', () => {
    expect(formatPrsPerDay(1059.6)).toBe('1,059.60 PRs/day')
  })
})

describe('formatMultiplier', () => {
  it.each([
    { multiplier: 1.51, shown: '1.51×' },
    { multiplier: 1.162, shown: '1.162×' },
    { multiplier: 0.30000000000000004, shown: '0.3×' },
  ])('shows $shown for $multiplier', ({ multiplier, shown }) => {
    expect(formatMultiplier(multiplier)).toBe(shown)
  })
})

describe('formatLocPerHour', () => {
  it.each([
    { locPerHour: 600, shown: '600 LOC/hr' },
    { locPerHour: 3000, shown: '3,000 LOC/hr' },
  ])('shows $shown for $locPerHour', ({ locPerHour, shown }) => {
    expect(formatLocPerHour(locPerHour)).toBe(shown)
  })
})
