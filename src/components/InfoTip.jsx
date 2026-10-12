import { useRef } from 'react'
import { TYPE_CLASS } from '../laneConfig.js'
import { Icon } from './Icon.jsx'
import { useOpenTipContext } from './useOpenTip.js'
import { useTipPlacement } from './useTipPlacement.js'

// Complete class literals so Tailwind's scanner finds them.
const BUTTON_CLASS = 'inline-flex size-6 shrink-0 items-center justify-center rounded text-gray-300'
const TIP_CLASS = `absolute right-0 left-0 z-10 rounded border border-gray-400 bg-gray-900 p-2 text-gray-50 ${TYPE_CLASS.label}`
const TIP_ABOVE_CLASS = 'bottom-full'

// An info button and its tip. The tip's placement (above the slider column or below the button)
// comes from useTipPlacement.
export function InfoTip({ id, label, text, isAlwaysBelow = false }) {
  const openTip = useOpenTipContext()
  const isShown = openTip.isShown(id)
  const buttonRef = useRef(null)
  const tipRef = useRef(null)
  const belowTop = useTipPlacement({ isShown, isAlwaysBelow, buttonRef, tipRef })

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
