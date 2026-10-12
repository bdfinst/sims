import { LANE_MODELS, floorShow, laneParams } from '../engine.js'
import { LANE_PRESENTATION } from '../laneConfig.js'
import { Icon } from './Icon.jsx'
import { RateSlider } from './RateSlider.jsx'

function DerivedValue({ children }) {
  return (
    <p className="text-base text-gray-300">
      {children}{' '}
      <span className="rounded bg-white/10 px-1 text-sm uppercase tracking-wide">derived</span>
    </p>
  )
}

export function Lane({ laneId, lane, settings, onSettingChange }) {
  const presentation = LANE_PRESENTATION[laneId]
  const model = LANE_MODELS[laneId]
  const params = laneParams(settings, model)
  const renderSlider = (settingKey) => (
    <RateSlider
      key={settingKey}
      settingKey={settingKey}
      value={settings[settingKey]}
      onChange={onSettingChange}
      accentClass={presentation.accentSliderClass}
    />
  )
  return (
    <section
      data-lane={laneId}
      data-accent={presentation.accent}
      aria-label={`${presentation.label} lane`}
      className={`grid gap-4 rounded border-t-4 bg-white/5 p-4 md:grid-cols-3 ${presentation.accentBorderClass}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Icon name={presentation.generationIcon} className={presentation.accentTextClass} />
          <h2 className="text-xl font-semibold">{presentation.label}</h2>
        </div>
        {presentation.inputSliders.map(renderSlider)}
        {presentation.showsDerivedValues && (
          <DerivedValue>
            PR size {params.size} LOC (×{model.sizeMultiplier})
          </DerivedValue>
        )}
      </div>
      <div className="rounded border border-gray-600 p-4">
        <p className="text-base">Pending Review</p>
        <p data-metric="pending" className="text-4xl font-bold">
          {floorShow(lane.pendingPrs)}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Icon name={presentation.reviewIcon} className={presentation.accentTextClass} />
          <p className="text-base">Review</p>
        </div>
        {presentation.reviewSliders.map(renderSlider)}
        {presentation.showsDerivedValues && (
          <DerivedValue>Effective speed {params.effSpeed} LOC/hr</DerivedValue>
        )}
        <div>
          <p className="text-base">Deployed</p>
          <p data-metric="deployed" className="text-4xl font-bold text-deployed">
            {floorShow(lane.deployedPrs)}
          </p>
        </div>
      </div>
    </section>
  )
}
