import * as lucide from 'lucide-react'
import { describe, expect, it } from 'vitest'

// Icon.jsx maps its five names to these exports; a rename upstream must fail here, not at runtime.
const ICON_EXPORTS = ['User', 'Bot', 'Eye', 'TriangleAlert', 'ChevronDown']

describe('installed lucide-react', () => {
  it.each(ICON_EXPORTS)('exports %s', (exportName) => {
    expect(lucide).toHaveProperty(exportName)
  })
})
