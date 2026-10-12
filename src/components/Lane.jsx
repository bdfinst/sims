import { floorShow } from '../engine.js'
import { LANE_PRESENTATION } from '../laneConfig.js'
import { Icon } from './Icon.jsx'

export function Lane({ laneId, lane }) {
  const presentation = LANE_PRESENTATION[laneId]
  return (
    <section
      data-lane={laneId}
      data-accent={presentation.accent}
      aria-label={`${presentation.label} lane`}
      className={`grid gap-4 rounded border-t-4 bg-white/5 p-4 md:grid-cols-3 ${presentation.accentBorderClass}`}
    >
      <div className="flex items-center gap-2">
        <Icon name={presentation.generationIcon} className={presentation.accentTextClass} />
        <h2 className="text-xl font-semibold">{presentation.label} generation</h2>
      </div>
      <div className="rounded border border-gray-600 p-4">
        <p className="text-base">Pending Review</p>
        <p data-metric="pending" className="text-4xl font-bold">
          {floorShow(lane.pendingPrs)}
        </p>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <Icon name={presentation.reviewIcon} className={presentation.accentTextClass} />
          <p className="text-base">Review</p>
        </div>
        <p className="text-base">Deployed</p>
        <p data-metric="deployed" className="text-4xl font-bold text-deployed">
          {floorShow(lane.deployedPrs)}
        </p>
      </div>
    </section>
  )
}
