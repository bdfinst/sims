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

export const ACTION = Object.freeze({
  tick: 'tick',
  start: 'start',
  pause: 'pause',
  reset: 'reset',
  setSetting: 'setSetting',
})

const emptyLanes = () =>
  Object.freeze(
    Object.fromEntries(
      Object.values(LANE_IDS).map((laneId) => [laneId, Object.freeze(emptyLane())]),
    ),
  )

export const initialState = Object.freeze({
  settings: DEFAULT_SETTINGS,
  lanes: emptyLanes(),
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
  [ACTION.start]: (state) => ({ ...state, isRunning: true }),
  [ACTION.pause]: (state) => ({ ...state, isRunning: false }),
  [ACTION.reset]: (state) => ({ ...initialState, settings: state.settings }),
  [ACTION.setSetting]: setSetting,
  [ACTION.tick]: (state) =>
    state.isRunning ? { ...state, lanes: tickLanes(state), ticks: state.ticks + 1 } : state,
}

export const reducer = (state, action) =>
  Object.hasOwn(HANDLERS, action.type) ? HANDLERS[action.type](state, action) : state
