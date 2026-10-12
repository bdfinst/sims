import { LANE_IDS, formatHeadlineRatio } from '../engine.js'

export function HeadlineBand({ lanes }) {
  return (
    <section className="flex flex-wrap items-baseline gap-4">
      <span data-metric="headlineRatio" className="text-6xl font-bold">
        {formatHeadlineRatio(lanes[LANE_IDS.ai], lanes[LANE_IDS.human])}
      </span>
      <span className="text-base text-gray-300">more incidents per PR from AI-generated code</span>
    </section>
  )
}
