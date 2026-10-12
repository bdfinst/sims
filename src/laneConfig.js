// Presentation only. Numeric behavior lives in engine.js.
// Tailwind class strings must stay complete literals so the scanner finds them.

export const LANE_PRESENTATION = Object.freeze({
  human: Object.freeze({
    label: 'Human',
    accent: 'blue',
    generationIcon: 'user',
    reviewIcon: 'eye',
    accentBorderClass: 'border-human',
    accentTextClass: 'text-human',
  }),
  ai: Object.freeze({
    label: 'AI',
    accent: 'purple',
    generationIcon: 'bot',
    reviewIcon: 'eye',
    accentBorderClass: 'border-ai',
    accentTextClass: 'text-ai',
  }),
})

export const LANE_ORDER = Object.freeze(['human', 'ai'])
