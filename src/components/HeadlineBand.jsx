import { formatHeadlineRatio } from '../engine.js'
import { COLOR_CLASS, TYPE_CLASS } from '../laneConfig.js'
import { MetricValue } from './MetricValue.jsx'

export function HeadlineBand({ lanes }) {
  return (
    <section aria-label="Headline ratio" className="flex flex-wrap items-baseline gap-4">
      <span className={TYPE_CLASS.headline}>
        <MetricValue name="headlineRatio" value={formatHeadlineRatio(lanes)} />
      </span>
      <span className={`${TYPE_CLASS.label} ${COLOR_CLASS.mutedText}`}>
        more incidents per PR from AI-generated code
      </span>
    </section>
  )
}
