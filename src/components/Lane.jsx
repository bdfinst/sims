import { LANE_PRESENTATION } from '../laneConfig.js'
import { Icon } from './Icon.jsx'

const INITIAL_COUNT = 0

export function Lane({ laneId }) {
  const lane = LANE_PRESENTATION[laneId]
  return (
    <section
      data-lane={laneId}
      data-accent={lane.accent}
      aria-label={`${lane.label} lane`}
      className={`grid gap-4 rounded border-t-4 bg-white/5 p-4 md:grid-cols-3 ${lane.accentBorderClass}`}
    >
      <div className="flex items-center gap-2">
        <Icon name={lane.generationIcon} className={lane.accentTextClass} />
        <h2 className="text-xl font-semibold">{lane.label} generation</h2>
      </div>
      <div className="rounded border border-gray-600 p-4">
        <p className="text-base">Pending Review</p>
        <p data-metric="pending" className="text-4xl font-bold">
          {INITIAL_COUNT}
        </p>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <Icon name={lane.reviewIcon} className={lane.accentTextClass} />
          <p className="text-base">Review</p>
        </div>
        <p className="text-base">Deployed</p>
        <p data-metric="deployed" className="text-4xl font-bold text-deployed">
          {INITIAL_COUNT}
        </p>
      </div>
    </section>
  )
}
