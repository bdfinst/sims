import { DEFAULT_SETTINGS, LANE_IDS, LANE_MODELS, emptyLane, laneParams, tick } from './engine.js'

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

const HANDLERS = {
  start: (state) => ({ ...state, isRunning: true }),
  pause: (state) => ({ ...state, isRunning: false }),
  tick: (state) =>
    state.isRunning ? { ...state, lanes: tickLanes(state), ticks: state.ticks + 1 } : state,
}

export const reducer = (state, action) => (HANDLERS[action.type] ?? ((current) => current))(state)
