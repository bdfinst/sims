import { useLayoutEffect, useRef, useState } from 'react'
import { TYPE_CLASS } from '../laneConfig.js'
import { Icon } from './Icon.jsx'
import { useOpenTipContext } from './useOpenTip.js'

// Complete class literals so Tailwind's scanner finds them.
const BUTTON_CLASS = 'inline-flex size-6 shrink-0 items-center justify-center rounded text-gray-300'
const TIP_CLASS = `absolute right-0 left-0 z-10 rounded border border-gray-400 bg-gray-900 p-2 text-gray-50 ${TYPE_CLASS.label}`
const TIP_ABOVE_CLASS = 'bottom-full'

// An info button and its tip. The tip is absolutely placed against its nearest positioned
// ancestor (the slider column): above it, or, when the space above the viewport's top edge is too
// short or `isAlwaysBelow` is set, directly below the button (covering the slider, stacked above
// it). While shown, the choice is measured again whenever the page scrolls or the window resizes.
export function InfoTip({ id, label, text, isAlwaysBelow = false }) {
  const openTip = useOpenTipContext()
  const isShown = openTip.isShown(id)
  const buttonRef = useRef(null)
  const tipRef = useRef(null)
  // The tip's top in px when it sits below the button; null when it sits above the column.
  const [belowTop, setBelowTop] = useState(null)

  useLayoutEffect(() => {
    if (!isShown) return undefined
    const tip = tipRef.current
    const button = buttonRef.current
    // The button shares the tip's offsetParent, so its bottom edge is a top for the tip.
    const measure = () =>
      setBelowTop(
        isAlwaysBelow || tip.offsetParent.getBoundingClientRect().top < tip.offsetHeight
          ? button.offsetTop + button.offsetHeight
          : null,
      )
    measure()
    // Capture, so a scroll of any scrolling ancestor is seen, not only the window's.
    window.addEventListener('scroll', measure, { capture: true, passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, { capture: true })
      window.removeEventListener('resize', measure)
    }
  }, [isShown, isAlwaysBelow])

  return (
    <span className="inline-flex" {...openTip.anchorProps(id)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={id}
        className={BUTTON_CLASS}
        {...openTip.buttonProps(id)}
      >
        <Icon name="info" className="size-5" />
      </button>
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        hidden={!isShown}
        className={belowTop === null ? `${TIP_CLASS} ${TIP_ABOVE_CLASS}` : TIP_CLASS}
        style={belowTop === null ? undefined : { top: belowTop }}
      >
        {text}
      </span>
    </span>
  )
}
