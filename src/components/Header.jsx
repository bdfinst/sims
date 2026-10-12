import { SECONDS_PER_WORK_HOUR, formatElapsedHours } from '../engine.js'
import { COLOR_CLASS } from '../laneConfig.js'
import { RateSlider } from './RateSlider.jsx'

const TITLE = 'AI vs. Human Code Review Simulator'
const DESCRIPTION =
  'Watch AI-speed code generation swamp human reviewers and push more defects into production.'
const ELAPSED_CAPTION = `${SECONDS_PER_WORK_HOUR} s = 1 work hour`

const PRIMARY_BUTTON_CLASS = `rounded px-4 py-2 text-base font-semibold ${COLOR_CLASS.primaryButton}`
const SECONDARY_BUTTON_CLASS = `rounded border px-4 py-2 text-base font-semibold ${COLOR_CLASS.secondaryButtonBorder}`

export function Header({ isRunning, ticks, threshold, onToggleRunning, onReset, onSettingChange }) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-3xl font-bold">{TITLE}</h1>
        <p className={`text-base ${COLOR_CLASS.mutedText}`}>{DESCRIPTION}</p>
      </div>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-4">
            <button type="button" onClick={onToggleRunning} className={PRIMARY_BUTTON_CLASS}>
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button type="button" onClick={onReset} className={SECONDARY_BUTTON_CLASS}>
              Reset
            </button>
            <span className={`text-base ${COLOR_CLASS.mutedText}`}>
              {isRunning ? 'Running' : 'Paused'}
            </span>
          </div>
          <p className="text-base">
            <span className="text-xl font-semibold">{formatElapsedHours(ticks)} work hours</span>{' '}
            <span className={COLOR_CLASS.faintText}>{ELAPSED_CAPTION}</span>
          </p>
        </div>
        <div className="w-64">
          <RateSlider settingKey="threshold" value={threshold} onSettingChange={onSettingChange} />
        </div>
      </div>
    </header>
  )
}
