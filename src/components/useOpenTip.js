import { createContext, useEffect, useReducer, useRef } from 'react'
import { INITIAL_TIP_STATE, TIP_EVENT, isTipShown, openTipReducer } from '../openTip.js'

// Hands useOpenTip's result from App to every InfoTip.
export const OpenTipContext = createContext(null)

const FOCUS_VISIBLE = ':focus-visible'

// Owns which info tip is open (rules in openTip.js). While a tip is shown, Escape anywhere closes
// it, and a pointer down outside its button and tip closes it if pinned; both document listeners
// exist only while a tip is shown.
export function useOpenTip() {
  const [state, dispatch] = useReducer(openTipReducer, INITIAL_TIP_STATE)
  // Each tip's hover area (its button and tip), so a pointer down can be told inside from outside.
  const anchorsRef = useRef(new Map())
  const shownKey = isTipShown(state, state.activeKey) ? state.activeKey : null

  useEffect(() => {
    if (shownKey === null) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') dispatch({ type: TIP_EVENT.escape })
    }
    const closeOnPointerDownOutside = (event) => {
      if (!anchorsRef.current.get(shownKey)?.contains(event.target)) {
        dispatch({ type: TIP_EVENT.pointerDownOutside })
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnPointerDownOutside)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnPointerDownOutside)
    }
  }, [shownKey])

  const anchorProps = (key) => ({
    ref: (element) => {
      anchorsRef.current.set(key, element)
      return () => anchorsRef.current.delete(key)
    },
    onPointerEnter: ({ pointerType }) =>
      dispatch({ type: TIP_EVENT.pointerEnter, key, pointerType }),
    onPointerLeave: () => dispatch({ type: TIP_EVENT.pointerLeave, key }),
  })

  const buttonProps = (key) => ({
    onFocus: ({ currentTarget }) =>
      dispatch({
        type: TIP_EVENT.focus,
        key,
        isFocusVisible: currentTarget.matches(FOCUS_VISIBLE),
      }),
    onBlur: () => dispatch({ type: TIP_EVENT.blur, key }),
    onClick: () => dispatch({ type: TIP_EVENT.press, key }),
  })

  return { isShown: (key) => isTipShown(state, key), anchorProps, buttonProps }
}
