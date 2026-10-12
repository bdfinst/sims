import { displayedPending, formatLoc, isOverThreshold, tileLayout } from '../engine.js'
import { COLOR_CLASS, QUEUE_STATE, QUEUE_STATE_CLASS, TILE_CAPACITY } from '../laneConfig.js'
import { Icon } from './Icon.jsx'
import { MetricValue } from './MetricValue.jsx'

// Everything that varies with the warning comes from the one comparison in isOverThreshold.
const queueAppearance = (laneLabel, displayed, threshold) => {
  const isWarning = isOverThreshold(displayed, threshold)
  const state = isWarning ? QUEUE_STATE.warning : QUEUE_STATE.normal
  return {
    isWarning,
    state,
    boxClass: QUEUE_STATE_CLASS[state],
    statusText: isWarning ? `${laneLabel} Pending Review over threshold` : '',
  }
}

export function QueueBox({ laneLabel, lane, threshold, tileClass }) {
  const displayed = displayedPending(lane)
  const { isWarning, state, boxClass, statusText } = queueAppearance(
    laneLabel,
    displayed,
    threshold,
  )
  const { tiles, overflow } = tileLayout(displayed, TILE_CAPACITY)
  return (
    <div
      data-state={state}
      data-capacity={TILE_CAPACITY}
      className={`rounded border p-3 ${boxClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <dl>
          <div>
            <dt className="text-base">Pending Review</dt>
            <dd className="text-4xl font-bold">
              <MetricValue name="pending" value={displayed} />
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-base">Pending LOC</dt>
            <dd className="text-xl font-semibold">
              <MetricValue name="pendingLoc" value={formatLoc(lane.pendingLoc)} />
            </dd>
          </div>
        </dl>
        {isWarning && <Icon name="triangle-alert" className={COLOR_CLASS.warningText} />}
      </div>
      <div aria-hidden="true" className="mt-2 flex flex-wrap gap-1">
        {Array.from({ length: tiles }, (_, tileIndex) => (
          <span key={tileIndex} data-tile className={`size-3 rounded-sm ${tileClass}`} />
        ))}
      </div>
      {overflow > 0 && <p className="mt-1 text-base">+{overflow} more</p>}
      {/* Always mounted, so a screen reader announces the text when it changes. */}
      <p role="status" className="sr-only">
        {statusText}
      </p>
    </div>
  )
}
