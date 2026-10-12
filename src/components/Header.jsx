import { SECONDS_PER_WORK_HOUR, formatElapsedHours } from '../engine.js'
import { RateSlider } from './RateSlider.jsx'

const TITLE = 'AI vs. Human Code Review Simulator'
const DESCRIPTION =
  'Watch AI-speed code generation swamp human reviewers and push more defects into production.'
const ELAPSED_CAPTION = `${SECONDS_PER_WORK_HOUR} s = 1 work hour`

export function Header({ isRunning, ticks, threshold, onToggleRunning, onReset, onSettingChange }) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-3xl font-bold">{TITLE}</h1>
        <p className="text-base text-gray-300">{DESCRIPTION}</p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleRunning}
            className="rounded bg-human px-4 py-2 text-base font-semibold"
          >
            {isRunning ? 'Pause' : 'Start'}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded border border-gray-500 px-4 py-2 text-base font-semibold"
          >
            Reset
          </button>
          <span className="text-base text-gray-300">{isRunning ? 'Running' : 'Paused'}</span>
        </div>
        <p className="text-base">
          <span className="text-xl font-semibold">{formatElapsedHours(ticks)} work hours</span>{' '}
          <span className="text-gray-400">{ELAPSED_CAPTION}</span>
        </p>
        <RateSlider settingKey="threshold" value={threshold} onSettingChange={onSettingChange} />
      </div>
    </header>
  )
}
