import {
  DEFAULT_SETTINGS,
  LANE_IDS,
  LANE_MODELS,
  SLIDERS,
  emptyLane,
  laneParams,
  snapToSlider,
  tick,
} from './engine.js'

export const initialState = Object.freeze({
  settings: DEFAULT_SETTINGS,
  lanes: Object.freeze({ [LANE_IDS.human]: emptyLane(), [LANE_IDS.ai]: emptyLane() }),
  ticks: 0,
  isRunning: false,
})

const tickLanes = (state) =>
  Object.fromEntries(
    Object.entries(state.lanes).map(([laneId, lane]) => [
      laneId,
      tick(lane, laneParams(state.settings, LANE_MODELS[laneId])),
    ]),
  )

const setSetting = (state, { key, value }) => {
  const isValidChange = Object.hasOwn(SLIDERS, key) && Number.isFinite(value)
  if (!isValidChange) return state
  return { ...state, settings: { ...state.settings, [key]: snapToSlider(key, value) } }
}

const HANDLERS = {
  start: (state) => ({ ...state, isRunning: true }),
  pause: (state) => ({ ...state, isRunning: false }),
  setSetting,
  tick: (state) =>
    state.isRunning ? { ...state, lanes: tickLanes(state), ticks: state.ticks + 1 } : state,
}

export const reducer = (state, action) =>
  Object.hasOwn(HANDLERS, action.type) ? HANDLERS[action.type](state, action) : state
