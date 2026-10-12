import { LANE_IDS, formatHeadlineRatio } from '../engine.js'
import { MetricValue } from './MetricValue.jsx'

export function HeadlineBand({ lanes }) {
  return (
    <section aria-label="Headline ratio" className="flex flex-wrap items-baseline gap-4">
      <span className="text-6xl font-bold">
        <MetricValue
          name="headlineRatio"
          value={formatHeadlineRatio(lanes[LANE_IDS.ai], lanes[LANE_IDS.human])}
        />
      </span>
      <span className="text-base text-gray-300">more incidents per PR from AI-generated code</span>
    </section>
  )
}
