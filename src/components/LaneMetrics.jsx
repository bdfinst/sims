import {
  displayedDeployed,
  displayedIncidents,
  formatDefectsCaught,
  formatIncidentsPerPr,
  formatPickupWaitHours,
} from '../engine.js'
import { COLOR_CLASS } from '../laneConfig.js'
import { MetricValue } from './MetricValue.jsx'

// One list of rows, so both lanes show the same rows in the same order.
const metricRows = (lane, params) => [
  {
    name: 'deployed',
    label: 'Deployed',
    value: displayedDeployed(lane),
    valueClass: `text-4xl font-bold ${COLOR_CLASS.deployedText}`,
  },
  { name: 'defectsCaught', label: 'Defects caught', value: formatDefectsCaught(params) },
  { name: 'incidents', label: 'Incidents', value: displayedIncidents(lane) },
  { name: 'incidentsPerPr', label: 'Incidents per PR', value: formatIncidentsPerPr(lane) },
  {
    name: 'pickupWait',
    label: 'Pickup wait',
    value: formatPickupWaitHours(lane, params),
    unit: 'h',
    unitTitle: 'hours',
  },
]

const DEFAULT_VALUE_CLASS = 'text-xl font-semibold'

export function LaneMetrics({ lane, params }) {
  return (
    <dl className="grid grid-cols-[9.5rem_1fr] items-baseline gap-x-3 gap-y-0.5">
      {metricRows(lane, params).map(({ name, label, value, valueClass, unit, unitTitle }) => (
        <div key={name} className="contents">
          <dt className="text-base">{label}</dt>
          <dd className={valueClass ?? DEFAULT_VALUE_CLASS}>
            <MetricValue name={name} value={value} unit={unit} unitTitle={unitTitle} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
