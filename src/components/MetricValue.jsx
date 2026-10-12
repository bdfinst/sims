import { NO_VALUE } from '../engine.js'

// The data-metric hook sits on a span whose text is exactly the shown value (and unit). A blank
// value is hidden from screen readers and replaced by words, so "—" is never read as a dash.
export function MetricValue({ name, value, unit, unitTitle }) {
  const isUnavailable = value === NO_VALUE
  return (
    <>
      <span data-metric={name} aria-hidden={isUnavailable || undefined}>
        {value}
        {unit && (
          <>
            {' '}
            <abbr title={unitTitle}>{unit}</abbr>
          </>
        )}
      </span>
      {isUnavailable && <span className="sr-only">Not yet available</span>}
    </>
  )
}
