// The info-tip open/close rules (plan, "Open/close truth table"). Pure: no React or DOM.
// One tip is active at a time. A tip is shown when it is the active tip, it is not dismissed, and
// it is hovered by a mouse, has keyboard focus, or is pinned by a press (click, tap, Enter, Space).

export const TIP_EVENT = Object.freeze({
  pointerEnter: 'pointerEnter',
  pointerLeave: 'pointerLeave',
  focus: 'focus',
  blur: 'blur',
  press: 'press',
  pointerDownOutside: 'pointerDownOutside',
  escape: 'escape',
})

// Only a mouse hovers; a touch reaches a tip through its press.
export const HOVER_POINTER_TYPE = 'mouse'

export const INITIAL_TIP_STATE = Object.freeze({
  activeKey: null,
  hoveredKey: null,
  focusedKey: null,
  isPinned: false,
  isDismissed: false,
})

export const isTipShown = (state, key) =>
  key !== null &&
  key === state.activeKey &&
  !state.isDismissed &&
  (key === state.hoveredKey || key === state.focusedKey || state.isPinned)

// Makes `key` the active, undismissed tip. Switching to another tip drops the old tip's pin.
const activate = (state, key) => ({
  ...state,
  activeKey: key,
  isPinned: key === state.activeKey && state.isPinned,
  isDismissed: false,
})

const dismiss = (state) => ({ ...state, isPinned: false, isDismissed: true })

const press = (state, key) => {
  if (!isTipShown(state, key)) return { ...activate(state, key), isPinned: true }
  return state.isPinned ? dismiss(state) : { ...state, isPinned: true }
}

export const openTipReducer = (state, event) => {
  switch (event.type) {
    case TIP_EVENT.pointerEnter:
      if (event.pointerType !== HOVER_POINTER_TYPE) return state
      return { ...activate(state, event.key), hoveredKey: event.key }
    case TIP_EVENT.pointerLeave:
      return event.key === state.hoveredKey ? { ...state, hoveredKey: null } : state
    case TIP_EVENT.focus:
      if (!event.isFocusVisible) return state
      return { ...activate(state, event.key), focusedKey: event.key }
    case TIP_EVENT.blur:
      return event.key === state.focusedKey ? { ...state, focusedKey: null } : state
    case TIP_EVENT.press:
      return press(state, event.key)
    case TIP_EVENT.pointerDownOutside:
      return state.isPinned ? dismiss(state) : state
    case TIP_EVENT.escape:
      return isTipShown(state, state.activeKey) ? dismiss(state) : state
    default:
      return state
  }
}
