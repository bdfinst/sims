import { COLOR_CLASS, TYPE_CLASS } from '../laneConfig.js'
import { FINDINGS, RESEARCH_TITLE, assumptionsNote } from '../research.js'

// The new-tab notice is in the accessible name only, so a link in mid-sentence leaves the
// sentence's visible (and copied) text unbroken.
function NewTabLink({ href, text }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={`${text} (opens in new tab)`}
      className={COLOR_CLASS.link}
    >
      {text}
    </a>
  )
}

export function ResearchPanel() {
  return (
    <details className={`rounded p-3 break-words ${COLOR_CLASS.lanePanel}`}>
      <summary className={`cursor-pointer ${TYPE_CLASS.value}`}>
        <h2 className="inline">{RESEARCH_TITLE}</h2>
      </summary>
      <ul className="mt-3 flex flex-col gap-3">
        {FINDINGS.map(({ id, kind, text, source }) => (
          <li key={id} data-kind={kind} className={TYPE_CLASS.label}>
            <p>{text}</p>
            <NewTabLink href={source.url} text={source.label} />
          </li>
        ))}
      </ul>
      <p className={`mt-3 ${TYPE_CLASS.label} ${COLOR_CLASS.mutedText}`}>
        {assumptionsNote().map((segment, index) =>
          typeof segment === 'string' ? (
            segment
          ) : (
            <NewTabLink key={index} href={segment.url} text={segment.text} />
          ),
        )}
      </p>
    </details>
  )
}
