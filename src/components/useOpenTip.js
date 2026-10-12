import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import {
  INITIAL_TIP_STATE,
  TIP_EVENT,
  isTipShown,
  openTipReducer,
  shownTipKey,
} from '../openTip.js'

// Hands useOpenTip's result from App to every InfoTip.
export const OpenTipContext = createContext(null)

// useOpenTip's result, as handed down by App. Fails loudly outside the provider.
export function useOpenTipContext() {
  const openTip = useContext(OpenTipContext)
  if (openTip === null)
    throw new Error('InfoTip must be rendered inside the OpenTipContext provider')
  return openTip
}

const FOCUS_VISIBLE = ':focus-visible'

// Owns which info tip is open (rules in openTip.js). While a tip is shown, Escape anywhere closes
// it, and a pointer down outside its button and tip closes it if pinned; both document listeners
// exist only while a tip is shown. The result keeps its identity until the tip state changes.
export function useOpenTip() {
  const [state, dispatch] = useReducer(openTipReducer, INITIAL_TIP_STATE)
  // Each tip's hover area (its button and tip), so a pointer down can be told inside from outside.
  const anchorsRef = useRef(new Map())
  const shownKey = shownTipKey(state)

  // A layout effect, so the listeners are in place before the tip paints: an Escape pressed the
  // moment a tip appears still closes it.
  useLayoutEffect(() => {
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

  const isShown = useCallback((key) => isTipShown(state, key), [state])

  const anchorProps = useCallback(
    (key) => ({
      ref: (element) => {
        anchorsRef.current.set(key, element)
        return () => anchorsRef.current.delete(key)
      },
      onPointerEnter: ({ pointerType }) =>
        dispatch({ type: TIP_EVENT.pointerEnter, key, pointerType }),
      onPointerLeave: () => dispatch({ type: TIP_EVENT.pointerLeave, key }),
    }),
    [],
  )

  const buttonProps = useCallback(
    (key) => ({
      onFocus: ({ currentTarget }) =>
        dispatch({
          type: TIP_EVENT.focus,
          key,
          isFocusVisible: currentTarget.matches(FOCUS_VISIBLE),
        }),
      onBlur: () => dispatch({ type: TIP_EVENT.blur, key }),
      onClick: () => dispatch({ type: TIP_EVENT.press, key }),
    }),
    [],
  )

  return useMemo(() => ({ isShown, anchorProps, buttonProps }), [isShown, anchorProps, buttonProps])
}
