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

const emptyLanes = () =>
  Object.fromEntries(Object.values(LANE_IDS).map((laneId) => [laneId, emptyLane()]))

export const initialState = Object.freeze({
  settings: DEFAULT_SETTINGS,
  lanes: Object.freeze(emptyLanes()),
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

const setSetting = (state, { settingKey, value }) => {
  const isValidChange = Object.hasOwn(SLIDERS, settingKey) && Number.isFinite(value)
  if (!isValidChange) return state
  return {
    ...state,
    settings: { ...state.settings, [settingKey]: snapToSlider(settingKey, value) },
  }
}

const HANDLERS = {
  start: (state) => ({ ...state, isRunning: true }),
  pause: (state) => ({ ...state, isRunning: false }),
  reset: (state) => ({ ...state, lanes: emptyLanes(), ticks: 0, isRunning: false }),
  setSetting,
  tick: (state) =>
    state.isRunning ? { ...state, lanes: tickLanes(state), ticks: state.ticks + 1 } : state,
}

export const reducer = (state, action) =>
  Object.hasOwn(HANDLERS, action.type) ? HANDLERS[action.type](state, action) : state
