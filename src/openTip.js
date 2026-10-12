// The info-tip open/close rules. Pure: no React or DOM.
// One tip is active at a time. A tip is shown when it is the active tip, it is not dismissed, and
// it is hovered by a mouse, has keyboard focus, or is pinned by a press (click, tap, Enter, Space).
// A tip closes only when the pointer and keyboard focus have both left it: when one of them leaves
// and no tip is left shown, the tip the other still holds shows again, unless Escape or a closing
// press dismissed it.

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
  // The hovered and the focused tip Escape or a closing press last dismissed, so neither shows again when the other
  // of pointer and focus leaves. Each is cleared once that tip is hovered or focused afresh.
  dismissedHoverKey: null,
  dismissedFocusKey: null,
})

export const isTipShown = (state, key) =>
  key !== null &&
  key === state.activeKey &&
  !state.isDismissed &&
  (key === state.hoveredKey || key === state.focusedKey || state.isPinned)

// The key of the tip on screen, or null when none is shown.
export const shownTipKey = (state) => (isTipShown(state, state.activeKey) ? state.activeKey : null)

// Makes `key` the active, undismissed tip. Switching to another tip drops the old tip's pin.
const activate = (state, key) => ({
  ...state,
  activeKey: key,
  isPinned: key === state.activeKey && state.isPinned,
  isDismissed: false,
})

const dismiss = (state) => ({ ...state, isPinned: false, isDismissed: true })

// Once a hover or a focus has ended: if no tip is left shown, the tip `waitingKey` still holds
// (focus or hover) shows again. A pinned or dismissed tip stays in charge, and so does a tip
// Escape or a closing press dismissed (`dismissedKey`).
const fallBackTo = (state, waitingKey, dismissedKey) => {
  const isWaiting =
    shownTipKey(state) === null &&
    waitingKey !== null &&
    waitingKey !== dismissedKey &&
    !state.isDismissed
  return isWaiting ? activate(state, waitingKey) : state
}

const endHover = (state) =>
  fallBackTo(
    { ...state, hoveredKey: null, dismissedHoverKey: null },
    state.focusedKey,
    state.dismissedFocusKey,
  )

const endFocus = (state) =>
  fallBackTo(
    { ...state, focusedKey: null, dismissedFocusKey: null },
    state.hoveredKey,
    state.dismissedHoverKey,
  )

// Clears a record of a tip's dismissal when that tip is engaged afresh.
const forget = (dismissedKey, key) => (dismissedKey === key ? null : dismissedKey)

// Escape and a closing press: dismisses the shown tip and records whether the pointer or focus
// still holds it, so it does not show again when the other of the two leaves.
const dismissShown = (state) => {
  const shownKey = shownTipKey(state)
  if (shownKey === null) return state
  return dismiss({
    ...state,
    dismissedHoverKey: shownKey === state.hoveredKey ? shownKey : state.dismissedHoverKey,
    dismissedFocusKey: shownKey === state.focusedKey ? shownKey : state.dismissedFocusKey,
  })
}

const pressTip = (state, key) => {
  const engaged = {
    ...state,
    dismissedHoverKey: forget(state.dismissedHoverKey, key),
    dismissedFocusKey: forget(state.dismissedFocusKey, key),
  }
  if (!isTipShown(state, key)) return { ...activate(engaged, key), isPinned: true }
  return state.isPinned ? dismissShown(engaged) : { ...engaged, isPinned: true }
}

export const openTipReducer = (state, event) => {
  switch (event.type) {
    case TIP_EVENT.pointerEnter:
      if (event.pointerType !== HOVER_POINTER_TYPE) return state
      return {
        ...activate(state, event.key),
        hoveredKey: event.key,
        dismissedHoverKey: forget(state.dismissedHoverKey, event.key),
      }
    case TIP_EVENT.pointerLeave:
      return event.key === state.hoveredKey ? endHover(state) : state
    case TIP_EVENT.focus:
      if (!event.isFocusVisible) return state
      return {
        ...activate(state, event.key),
        focusedKey: event.key,
        dismissedFocusKey: forget(state.dismissedFocusKey, event.key),
      }
    case TIP_EVENT.blur:
      return event.key === state.focusedKey ? endFocus(state) : state
    case TIP_EVENT.press:
      return pressTip(state, event.key)
    case TIP_EVENT.pointerDownOutside:
      return state.isPinned ? dismiss(state) : state
    case TIP_EVENT.escape:
      return dismissShown(state)
    default:
      return state
  }
}
