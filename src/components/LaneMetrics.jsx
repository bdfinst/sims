import {
  detection,
  floorShow,
  formatIncidentsPerPr,
  formatLoc,
  formatPct,
  formatPickupWait,
} from '../engine.js'

// Rows keep a fixed order so both lanes line up row for row.
export function LaneMetrics({ lane, params }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      <dt className="text-base">Defects caught</dt>
      <dd data-metric="defectsCaught" className="text-xl font-semibold">
        {formatPct(detection(params.size, params.effSpeed))}
      </dd>
      <dt className="text-base">Incidents</dt>
      <dd data-metric="incidents" className="text-xl font-semibold">
        {floorShow(lane.escapedDefects)}
      </dd>
      <dt className="text-base">Incidents per PR</dt>
      <dd data-metric="incidentsPerPr" className="text-xl font-semibold">
        {formatIncidentsPerPr(lane)}
      </dd>
      <dt className="text-base">Pending LOC</dt>
      <dd data-metric="pendingLoc" className="text-xl font-semibold">
        {formatLoc(lane.pendingLoc)}
      </dd>
      <dt className="text-base">Pickup wait</dt>
      <dd data-metric="pickupWait" className="text-xl font-semibold">
        {formatPickupWait(lane.pendingLoc, params.effSpeed)}
      </dd>
    </dl>
  )
}
