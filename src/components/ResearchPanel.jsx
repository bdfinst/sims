import { COLOR_CLASS, TYPE_CLASS } from '../laneConfig.js'
import { FINDINGS, RESEARCH_TITLE, assumptionsNote } from '../research.js'

function NewTabLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={COLOR_CLASS.link}>
      {children}
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  )
}

export function ResearchPanel() {
  const { choices, calibration } = assumptionsNote()
  return (
    <details className={`rounded p-3 break-words ${COLOR_CLASS.lanePanel}`}>
      <summary className={`cursor-pointer ${TYPE_CLASS.value}`}>
        <h2 className="inline">{RESEARCH_TITLE}</h2>
      </summary>
      <ul className="mt-3 flex flex-col gap-3">
        {FINDINGS.map(({ id, text, source }) => (
          <li key={id} className={TYPE_CLASS.label}>
            <p>{text}</p>
            <NewTabLink href={source.url}>{source.label}</NewTabLink>
          </li>
        ))}
      </ul>
      <p className={`mt-3 ${TYPE_CLASS.label} ${COLOR_CLASS.mutedText}`}>
        {choices} {calibration.lead}{' '}
        <NewTabLink href={calibration.url}>{calibration.linkText}</NewTabLink>.
      </p>
    </details>
  )
}
