import { SLIDERS } from '../engine.js'
import { SLIDER_PRESENTATION } from '../laneConfig.js'

export function RateSlider({ settingKey, value, onChange, accentClass }) {
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
          onChange={(event) => onChange(settingKey, event.target.valueAsNumber)}
          className={`w-full ${accentClass}`}
        />
        <output htmlFor={inputId} aria-live="off" className="shrink-0 text-xl font-semibold">
          {value}
          {unit}
        </output>
      </div>
    </div>
  )
}
