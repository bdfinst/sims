import { displayedPending, formatLoc, isOverThreshold } from '../engine.js'
import { Icon } from './Icon.jsx'
import { MetricValue } from './MetricValue.jsx'

// Class strings stay complete literals so Tailwind's scanner finds them.
const WARNING_BOX_CLASS = 'border-warning bg-warning/10'
const NORMAL_BOX_CLASS = 'border-gray-600'

export function QueueBox({ laneLabel, lane, threshold }) {
  const pending = displayedPending(lane)
  const isOver = isOverThreshold(pending, threshold)
  return (
    <div
      data-state={isOver ? 'warning' : 'normal'}
      className={`rounded border p-4 ${isOver ? WARNING_BOX_CLASS : NORMAL_BOX_CLASS}`}
    >
      <div className="flex items-start justify-between gap-2">
        <dl>
          <dt className="text-base">Pending Review</dt>
          <dd className="text-4xl font-bold">
            <MetricValue name="pending" value={pending} />
          </dd>
          <dt className="text-base">Pending LOC</dt>
          <dd className="text-xl font-semibold">
            <MetricValue name="pendingLoc" value={formatLoc(lane.pendingLoc)} />
          </dd>
        </dl>
        {isOver && <Icon name="triangle-alert" className="text-warning" />}
      </div>
      {/* Always mounted, so a screen reader announces the text when it changes. */}
      <p role="status" className="sr-only">
        {isOver ? `${laneLabel} Pending Review over threshold` : ''}
      </p>
    </div>
  )
}
