import { SLIDERS } from '../engine.js'
import { COLOR_CLASS, SLIDER_PRESENTATION, TYPE_CLASS } from '../laneConfig.js'

export function RateSlider({
  settingKey,
  value,
  onSettingChange,
  accentClass = COLOR_CLASS.neutralSliderAccent, // the threshold slider belongs to no lane
}) {
  const { min, max, step } = SLIDERS[settingKey]
  const { label, unit, spokenUnit } = SLIDER_PRESENTATION[settingKey]
  const inputId = `slider-${settingKey}`
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className={TYPE_CLASS.label}>
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
          className={`shrink-0 ${TYPE_CLASS.value}`}
        >
          {value}
          {unit}
        </span>
      </div>
    </div>
  )
}
