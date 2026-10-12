import {
  displayedDeployed,
  formatDefectsCaught,
  formatIncidentsPerPr,
  formatPickupWaitHours,
  floorShow,
} from '../engine.js'
import { MetricValue } from './MetricValue.jsx'

// One list of rows, so both lanes show the same rows in the same order.
const metricRows = (lane, params) => [
  {
    name: 'deployed',
    label: 'Deployed',
    value: displayedDeployed(lane),
    valueClass: 'text-4xl font-bold text-deployed',
  },
  { name: 'defectsCaught', label: 'Defects caught', value: formatDefectsCaught(params) },
  { name: 'incidents', label: 'Incidents', value: floorShow(lane.escapedDefects) },
  { name: 'incidentsPerPr', label: 'Incidents per PR', value: formatIncidentsPerPr(lane) },
  {
    name: 'pickupWait',
    label: 'Pickup wait',
    value: formatPickupWaitHours(lane, params),
    unit: 'h',
  },
]

const DEFAULT_VALUE_CLASS = 'text-xl font-semibold'

export function LaneMetrics({ lane, params }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
      {metricRows(lane, params).map(({ name, label, value, valueClass, unit }) => (
        <div key={name} className="contents">
          <dt className="text-base">{label}</dt>
          <dd className={valueClass ?? DEFAULT_VALUE_CLASS}>
            <MetricValue name={name} value={value} unit={unit} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
