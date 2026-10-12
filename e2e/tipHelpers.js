// Info-tip and geometry helpers used only by info-tips.spec.js.
import { boxOf, slider } from './fixtures.js'

// The info tips on screen (getByRole skips hidden ones).
export const shownTips = (page) => page.getByRole('tooltip')

// The centre of an element's layout box.
export const centreOf = async (locator) => {
  const { x, y, width, height } = await boxOf(locator, 'element')
  return { x: x + width / 2, y: y + height / 2 }
}

// Moves the real mouse pointer to the centre of an element (a hover, with no click), scrolling it
// into view first so the pointer lands on it.
export const movePointerTo = async (page, locator) => {
  await locator.scrollIntoViewIfNeeded()
  const { x, y } = await centreOf(locator)
  await page.mouse.move(x, y)
}

// Glides the mouse from the button's centre straight to the tip's nearest edge, one pixel per
// move event, then into the tip. Any gap between button and tip is crossed, as a real pointer would.
export const movePointerOnto = async (page, button, tip) => {
  const start = await centreOf(button)
  const tipBox = await boxOf(tip, 'tip')
  const isTipAbove = tipBox.y < start.y
  const edgeY = isTipAbove ? tipBox.y + tipBox.height - 1 : tipBox.y + 1
  await page.mouse.move(start.x, start.y)
  await page.mouse.move(start.x, edgeY, { steps: Math.ceil(Math.abs(edgeY - start.y)) })
  await movePointerTo(page, tip)
}

export const overlaps = (first, second) =>
  first.x < second.x + second.width &&
  second.x < first.x + first.width &&
  first.y < second.y + second.height &&
  second.y < first.y + first.height

// The first button or input after the slider's label, in document order.
export const controlAfterLabel = (page, control) =>
  slider(page, control).evaluate((input) => {
    const label = document.querySelector(`label[for="${input.id}"]`)
    const following = [...document.querySelectorAll('button, input')].find(
      (element) => label.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING,
    )
    return following?.getAttribute('aria-label') ?? following?.id
  })

export const labelOf = async (page, control) => {
  const inputId = await slider(page, control).getAttribute('id')
  return page.locator(`label[for="${inputId}"]`)
}
