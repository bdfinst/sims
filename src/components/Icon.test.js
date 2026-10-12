import * as lucide from 'lucide-react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Icon } from './Icon.jsx'
import { ICONS } from './iconMap.js'

const ICON_ENTRIES = Object.entries(ICONS)
const lucideExports = new Set(Object.values(lucide))

describe('the icon map', () => {
  it.each(ICON_ENTRIES)(
    'maps "%s" to a component exported by the installed lucide-react',
    (_name, component) => {
      expect(lucideExports.has(component)).toBe(true)
    },
  )
})

describe('Icon', () => {
  it.each(ICON_ENTRIES)(
    'renders "%s" with its data-icon hook, hidden from screen readers',
    (name) => {
      const markup = renderToStaticMarkup(createElement(Icon, { name }))
      expect(markup).toContain(`data-icon="${name}"`)
      expect(markup).toContain('aria-hidden="true"')
    },
  )

  it.each(['nope', 'toString', '__proto__'])(
    'throws a clear error for the unknown name "%s"',
    (name) => {
      expect(() => renderToStaticMarkup(createElement(Icon, { name }))).toThrow(
        `Unknown icon: ${name}`,
      )
    },
  )
})
