import { COLOR_CLASS, TYPE_CLASS } from '../laneConfig.js'
import { FINDINGS, RESEARCH_TITLE, assumptionsNote } from '../research.js'

export function ResearchPanel() {
  return (
    <details className={`rounded p-3 break-words ${COLOR_CLASS.lanePanel}`}>
      <summary className={`cursor-pointer ${TYPE_CLASS.value}`}>{RESEARCH_TITLE}</summary>
      <ul className="mt-3 flex flex-col gap-3">
        {FINDINGS.map(({ id, text, source }) => (
          <li key={id} className={TYPE_CLASS.label}>
            <p>{text}</p>
            <a href={source.url} target="_blank" rel="noopener" className={COLOR_CLASS.link}>
              {source.label}
            </a>
          </li>
        ))}
      </ul>
      <p className={`mt-3 ${TYPE_CLASS.label} ${COLOR_CLASS.mutedText}`}>{assumptionsNote()}</p>
    </details>
  )
}
