import { SLIDERS } from '../engine.js'
import { SLIDER_PRESENTATION } from '../laneConfig.js'

// Sliders that belong to no lane (the warning threshold) use this neutral accent.
const NEUTRAL_ACCENT_CLASS = 'accent-gray-300'

export function RateSlider({
  settingKey,
  value,
  onSettingChange,
  accentClass = NEUTRAL_ACCENT_CLASS,
}) {
  const { min, max, step } = SLIDERS[settingKey]
  const { label, unit, spokenUnit } = SLIDER_PRESENTATION[settingKey]
  const inputId = `slider-${settingKey}`
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-base">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={`${value} ${spokenUnit}`}
          onChange={(event) => onSettingChange(settingKey, event.target.valueAsNumber)}
          className={`w-full ${accentClass}`}
        />
        <span
          id={`slider-value-${settingKey}`}
          aria-hidden="true"
          className="shrink-0 text-xl font-semibold"
        >
          {value}
          {unit}
        </span>
      </div>
    </div>
  )
}
