import { describe, expect, it } from 'vitest'
import { INITIAL_TIP_STATE, TIP_EVENT, isTipShown, openTipReducer, shownTipKey } from './openTip.js'

const TIP = 'tip-a'
const OTHER_TIP = 'tip-b'

// Events as the hook sends them.
const mouseEnter = (key) => ({ type: TIP_EVENT.pointerEnter, key, pointerType: 'mouse' })
const touchEnter = (key) => ({ type: TIP_EVENT.pointerEnter, key, pointerType: 'touch' })
const pointerLeave = (key) => ({ type: TIP_EVENT.pointerLeave, key })
const keyboardFocus = (key) => ({ type: TIP_EVENT.focus, key, isFocusVisible: true })
const pointerFocus = (key) => ({ type: TIP_EVENT.focus, key, isFocusVisible: false })
const blur = (key) => ({ type: TIP_EVENT.blur, key })
const press = (key) => ({ type: TIP_EVENT.press, key })
const POINTER_DOWN_OUTSIDE = { type: TIP_EVENT.pointerDownOutside }
const ESCAPE = { type: TIP_EVENT.escape }

const after = (...events) => events.reduce(openTipReducer, INITIAL_TIP_STATE)

// The tips shown after the events, so a test also sees that no other tip is open.
const shownAfter = (...events) => {
  const state = after(...events)
  return [TIP, OTHER_TIP].filter((key) => isTipShown(state, key))
}

const NONE_SHOWN = []

describe('openTipReducer, one test per truth-table row', () => {
  it('starts with no tip shown', () => {
    expect(shownAfter()).toEqual(NONE_SHOWN)
  })

  it('shows a tip when the mouse enters it, and hides any other tip', () => {
    expect(shownAfter(mouseEnter(TIP))).toEqual([TIP])
    expect(shownAfter(keyboardFocus(OTHER_TIP), mouseEnter(TIP))).toEqual([TIP])
  })

  it('hides a hovered tip when the mouse leaves it, unless it has keyboard focus or is pinned', () => {
    expect(shownAfter(mouseEnter(TIP), pointerLeave(TIP))).toEqual(NONE_SHOWN)
    expect(shownAfter(keyboardFocus(TIP), mouseEnter(TIP), pointerLeave(TIP))).toEqual([TIP])
    expect(shownAfter(mouseEnter(TIP), press(TIP), pointerLeave(TIP))).toEqual([TIP])
  })

  it('shows a tip when keyboard focus reaches its button, and hides any other tip', () => {
    expect(shownAfter(keyboardFocus(TIP))).toEqual([TIP])
    expect(shownAfter(mouseEnter(OTHER_TIP), keyboardFocus(TIP))).toEqual([TIP])
  })

  it('hides a focused tip when its button loses focus, unless it is hovered or pinned', () => {
    expect(shownAfter(keyboardFocus(TIP), blur(TIP))).toEqual(NONE_SHOWN)
    expect(shownAfter(keyboardFocus(TIP), mouseEnter(TIP), blur(TIP))).toEqual([TIP])
    expect(shownAfter(keyboardFocus(TIP), press(TIP), blur(TIP))).toEqual([TIP])
  })

  it('pins a shown, unpinned tip on a press, and the pin survives pointer-leave and blur', () => {
    const pinned = after(mouseEnter(TIP), keyboardFocus(TIP), press(TIP))
    expect(pinned.isPinned).toBe(true)

    const leftAndBlurred = [pointerLeave(TIP), blur(TIP)].reduce(openTipReducer, pinned)
    expect(isTipShown(leftAndBlurred, TIP)).toBe(true)
  })

  it('closes and unpins a pinned tip on a press', () => {
    const state = after(mouseEnter(TIP), press(TIP), press(TIP))
    expect(isTipShown(state, TIP)).toBe(false)
    expect(state.isPinned).toBe(false)
  })

  it('opens and pins a hidden tip on a press, and hides and unpins any other tip', () => {
    const state = after(mouseEnter(OTHER_TIP), press(OTHER_TIP), press(TIP))
    expect(isTipShown(state, TIP)).toBe(true)
    expect(isTipShown(state, OTHER_TIP)).toBe(false)
    expect(state).toMatchObject({ activeKey: TIP, isPinned: true })
  })

  it('closes and unpins a pinned tip on a pointer down outside it', () => {
    const state = after(press(TIP), POINTER_DOWN_OUTSIDE)
    expect(isTipShown(state, TIP)).toBe(false)
    expect(state.isPinned).toBe(false)
  })

  it('leaves a hovered, unpinned tip open on a pointer down outside it', () => {
    expect(shownAfter(mouseEnter(TIP), POINTER_DOWN_OUTSIDE)).toEqual([TIP])
  })

  it('closes a hovered tip on Escape without changing what is hovered', () => {
    const state = after(mouseEnter(TIP), ESCAPE)
    expect(isTipShown(state, TIP)).toBe(false)
    expect(state.hoveredKey).toBe(TIP)
  })

  it('closes a focused tip on Escape without changing what has focus', () => {
    const state = after(keyboardFocus(TIP), ESCAPE)
    expect(isTipShown(state, TIP)).toBe(false)
    expect(state.focusedKey).toBe(TIP)
  })

  it('closes and unpins a pinned tip on Escape', () => {
    const state = after(press(TIP), ESCAPE)
    expect(isTipShown(state, TIP)).toBe(false)
    expect(state.isPinned).toBe(false)
  })

  it.each([
    [
      'the mouse leaves and re-enters',
      [mouseEnter(TIP), ESCAPE, pointerLeave(TIP), mouseEnter(TIP)],
    ],
    [
      'keyboard focus leaves and returns',
      [keyboardFocus(TIP), ESCAPE, blur(TIP), keyboardFocus(TIP)],
    ],
    ['the button is pressed again', [mouseEnter(TIP), ESCAPE, press(TIP)]],
  ])('reopens a tip closed by Escape when %s', (_how, events) => {
    expect(shownAfter(...events)).toEqual([TIP])
  })

  it('reopens a tip closed by a press when the mouse leaves and re-enters', () => {
    expect(
      shownAfter(mouseEnter(TIP), press(TIP), press(TIP), pointerLeave(TIP), mouseEnter(TIP)),
    ).toEqual([TIP])
  })
})

describe('openTipReducer, named cases', () => {
  it('clears the previous pin when another tip opens', () => {
    const state = after(press(OTHER_TIP), mouseEnter(TIP), pointerLeave(TIP))
    expect(state.isPinned).toBe(false)
    expect([TIP, OTHER_TIP].filter((key) => isTipShown(state, key))).toEqual(NONE_SHOWN)
  })

  it('opens and pins on a touch tap, which enters without hovering', () => {
    const tapped = after(touchEnter(TIP), press(TIP), pointerLeave(TIP))
    expect(isTipShown(tapped, TIP)).toBe(true)
    expect(tapped).toMatchObject({ hoveredKey: null, isPinned: true })
  })

  it('does not hover on a touch pointer entering', () => {
    expect(shownAfter(touchEnter(TIP))).toEqual(NONE_SHOWN)
  })

  it('shows the keyboard-focused tip again when a hover on another tip ends', () => {
    expect(shownAfter(keyboardFocus(TIP), mouseEnter(OTHER_TIP))).toEqual([OTHER_TIP])
    expect(shownAfter(keyboardFocus(TIP), mouseEnter(OTHER_TIP), pointerLeave(OTHER_TIP))).toEqual([
      TIP,
    ])
  })

  it('keeps a pinned or dismissed hovered tip in charge when its hover ends', () => {
    expect(
      shownAfter(
        keyboardFocus(TIP),
        mouseEnter(OTHER_TIP),
        press(OTHER_TIP),
        pointerLeave(OTHER_TIP),
      ),
    ).toEqual([OTHER_TIP])
    expect(
      shownAfter(keyboardFocus(TIP), mouseEnter(OTHER_TIP), ESCAPE, pointerLeave(OTHER_TIP)),
    ).toEqual(NONE_SHOWN)
  })

  it('keeps a focused tip closed by Escape closed when a hover on another tip ends', () => {
    expect(
      shownAfter(keyboardFocus(TIP), ESCAPE, mouseEnter(OTHER_TIP), pointerLeave(OTHER_TIP)),
    ).toEqual(NONE_SHOWN)
  })

  it.each([
    ['its button loses and regains focus', [blur(TIP), keyboardFocus(TIP)]],
    ['its button is pressed', [press(TIP), press(TIP), press(TIP)]],
  ])('forgets that Escape closed a focused tip once %s', (_how, events) => {
    expect(
      shownAfter(
        keyboardFocus(TIP),
        ESCAPE,
        ...events,
        mouseEnter(OTHER_TIP),
        pointerLeave(OTHER_TIP),
      ),
    ).toEqual([TIP])
  })

  it('shows the hovered tip again when keyboard focus leaves another tip', () => {
    expect(shownAfter(mouseEnter(TIP), keyboardFocus(OTHER_TIP))).toEqual([OTHER_TIP])
    expect(shownAfter(mouseEnter(TIP), keyboardFocus(OTHER_TIP), blur(OTHER_TIP))).toEqual([TIP])
  })

  it('keeps a hovered tip closed by Escape closed when focus leaves another tip', () => {
    expect(shownAfter(mouseEnter(TIP), ESCAPE, keyboardFocus(OTHER_TIP), blur(OTHER_TIP))).toEqual(
      NONE_SHOWN,
    )
    expect(shownAfter(mouseEnter(TIP), keyboardFocus(OTHER_TIP), ESCAPE, blur(OTHER_TIP))).toEqual(
      NONE_SHOWN,
    )
  })

  it('forgets that Escape closed a hovered tip once the mouse leaves and re-enters it', () => {
    expect(
      shownAfter(
        mouseEnter(TIP),
        ESCAPE,
        pointerLeave(TIP),
        mouseEnter(TIP),
        keyboardFocus(OTHER_TIP),
        blur(OTHER_TIP),
      ),
    ).toEqual([TIP])
  })

  it('does not open on pointer-initiated focus alone', () => {
    expect(shownAfter(pointerFocus(TIP))).toEqual(NONE_SHOWN)
  })

  it('ignores a pointer leaving or a blur from a tip that is not hovered or focused', () => {
    expect(shownAfter(mouseEnter(TIP), pointerLeave(OTHER_TIP), blur(OTHER_TIP))).toEqual([TIP])
  })

  it('ignores Escape and unknown events when no tip is shown', () => {
    expect(after(ESCAPE)).toEqual(INITIAL_TIP_STATE)
    expect(after({ type: 'unknown' })).toEqual(INITIAL_TIP_STATE)
  })
})

describe('shownTipKey', () => {
  it('names the shown tip, or null when none is shown', () => {
    expect(shownTipKey(INITIAL_TIP_STATE)).toBeNull()
    expect(shownTipKey(after(mouseEnter(TIP)))).toBe(TIP)
    expect(shownTipKey(after(mouseEnter(TIP), pointerLeave(TIP)))).toBeNull()
    expect(shownTipKey(after(mouseEnter(TIP), ESCAPE))).toBeNull()
  })
})
