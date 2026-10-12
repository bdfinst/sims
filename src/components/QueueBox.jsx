import { displayedPending, formatLoc, isOverThreshold } from '../engine.js'
import {
  COLOR_CLASS,
  QUEUE_STATE,
  QUEUE_STATE_CLASS,
  TYPE_CLASS,
  tileLayout,
} from '../laneConfig.js'
import { Icon } from './Icon.jsx'
import { MetricValue } from './MetricValue.jsx'

// The state comes from the one comparison in isOverThreshold; the rest follows from it.
const queueAppearance = (laneLabel, displayed, threshold) => {
  const state = isOverThreshold(displayed, threshold) ? QUEUE_STATE.warning : QUEUE_STATE.normal
  return {
    state,
    boxClass: QUEUE_STATE_CLASS[state],
    statusText: state === QUEUE_STATE.warning ? `${laneLabel} Pending Review over threshold` : '',
  }
}

// Pure in the lane's displayed count and the tile capacity: the count, the tiles, "+N more" and
// the warning all come from the same `displayed`.
export function QueueBox({ laneLabel, lane, threshold, capacity, accentClass }) {
  const displayed = displayedPending(lane)
  const { state, boxClass, statusText } = queueAppearance(laneLabel, displayed, threshold)
  const { tileCount, overflowCount } = tileLayout(displayed, capacity)
  return (
    <div data-state={state} data-capacity={capacity} className={`rounded border p-3 ${boxClass}`}>
      <div className="flex items-start justify-between gap-2">
        <dl>
          <div>
            <dt className={TYPE_CLASS.label}>Pending Review</dt>
            <dd className={TYPE_CLASS.count}>
              <MetricValue name="pending" value={displayed} />
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className={TYPE_CLASS.label}>Pending LOC</dt>
            <dd className={TYPE_CLASS.value}>
              <MetricValue name="pendingLoc" value={formatLoc(lane.pendingLoc)} />
            </dd>
          </div>
        </dl>
        {state === QUEUE_STATE.warning && (
          <Icon name="triangle-alert" className={COLOR_CLASS.warningText} />
        )}
      </div>
      <div aria-hidden="true" className="mt-2 flex flex-wrap gap-1">
        {Array.from({ length: tileCount }, (_, tileIndex) => (
          <span key={tileIndex} data-tile className={`size-3 rounded-sm ${accentClass}`} />
        ))}
      </div>
      {overflowCount > 0 && <p className={`mt-1 ${TYPE_CLASS.label}`}>+{overflowCount} more</p>}
      {/* Always mounted, so a screen reader announces the text when it changes. */}
      <p role="status" className="sr-only">
        {statusText}
      </p>
    </div>
  )
}
