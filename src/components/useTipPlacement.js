import { useLayoutEffect, useState } from 'react'

// Where a shown info tip sits: above its slider column, or, when the space above the viewport's
// top edge is too short or `isAlwaysBelow` is set, directly below its button (covering the
// slider). Returns the tip's top in px when it sits below the button, or null when it sits above.
// While the tip is shown, the choice is measured again whenever the page scrolls or the window
// resizes.
//
// Requires a `relative` (positioned) ancestor shared by the button and the tip, such as the
// slider column: the tip is absolutely placed against it, and the button's offsetTop is measured
// from it.
export function useTipPlacement({ isShown, isAlwaysBelow, buttonRef, tipRef }) {
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
  }, [isShown, isAlwaysBelow, buttonRef, tipRef])

  return belowTop
}
