import { SLIDERS } from '../engine.js'
import { COLOR_CLASS, SLIDER_PRESENTATION, TYPE_CLASS } from '../laneConfig.js'
import { InfoTip } from './InfoTip.jsx'

export function RateSlider({
  settingKey,
  value,
  onSettingChange,
  accentClass = COLOR_CLASS.neutralSliderAccent, // the threshold slider belongs to no lane
  isAlwaysBelow = false, // the header's threshold tip opens below its button
}) {
  const { min, max, step } = SLIDERS[settingKey]
  const { label, unit, spokenUnit, info } = SLIDER_PRESENTATION[settingKey]
  const inputId = `slider-${settingKey}`
  const tipId = `info-${settingKey}`
  // `relative` anchors the info tip to this slider's column, above the label row or directly below the info button.
  return (
    <div className="relative flex flex-col gap-1">
      <div className="flex items-start gap-1">
        <label htmlFor={inputId} className={TYPE_CLASS.label}>
          {label}
        </label>
        <InfoTip id={tipId} label={label} text={info} isAlwaysBelow={isAlwaysBelow} />
      </div>
      <div className="flex items-center gap-3">
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={`${value} ${spokenUnit}`}
          aria-describedby={tipId}
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
