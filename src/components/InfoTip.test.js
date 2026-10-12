import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InfoTip } from './InfoTip.jsx'

describe('InfoTip', () => {
  it('fails with a clear message when rendered outside the OpenTipContext provider', () => {
    const orphanTip = createElement(InfoTip, { id: 'info-x', label: 'X', text: 'About X.' })
    expect(() => renderToStaticMarkup(orphanTip)).toThrow(
      'InfoTip must be rendered inside the OpenTipContext provider',
    )
  })
})
