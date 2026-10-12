import { displayedPending, formatLoc, isOverThreshold } from '../engine.js'
import { QUEUE_STATE, QUEUE_STATE_CLASS } from '../laneConfig.js'
import { Icon } from './Icon.jsx'
import { MetricValue } from './MetricValue.jsx'

// Everything that varies with the warning comes from the one comparison in isOverThreshold.
const queueAppearance = (laneLabel, lane, threshold) => {
  const isWarning = isOverThreshold(lane, threshold)
  const state = isWarning ? QUEUE_STATE.warning : QUEUE_STATE.normal
  return {
    isWarning,
    state,
    boxClass: QUEUE_STATE_CLASS[state],
    statusText: isWarning ? `${laneLabel} Pending Review over threshold` : '',
  }
}

export function QueueBox({ laneLabel, lane, threshold }) {
  const { isWarning, state, boxClass, statusText } = queueAppearance(laneLabel, lane, threshold)
  return (
    <div data-state={state} className={`rounded border p-4 ${boxClass}`}>
      <div className="flex items-start justify-between gap-2">
        <dl>
          <dt className="text-base">Pending Review</dt>
          <dd className="text-4xl font-bold">
            <MetricValue name="pending" value={displayedPending(lane)} />
          </dd>
          <dt className="text-base">Pending LOC</dt>
          <dd className="text-xl font-semibold">
            <MetricValue name="pendingLoc" value={formatLoc(lane.pendingLoc)} />
          </dd>
        </dl>
        {isWarning && <Icon name="triangle-alert" className="text-warning" />}
      </div>
      {/* Always mounted, so a screen reader announces the text when it changes. */}
      <p role="status" className="sr-only">
        {statusText}
      </p>
    </div>
  )
}
