import { LANE_MODELS, laneParams } from '../engine.js'
import { LANE_PRESENTATION } from '../laneConfig.js'
import { Icon } from './Icon.jsx'
import { LaneMetrics } from './LaneMetrics.jsx'
import { QueueBox } from './QueueBox.jsx'
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
  const hasDerivedValues = model.skimApplies || model.sizeMultiplier !== 1
  const renderSlider = (settingKey) => (
    <RateSlider
      key={settingKey}
      settingKey={settingKey}
      value={settings[settingKey]}
      onSettingChange={onSettingChange}
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
        {presentation.generationSliders.map(renderSlider)}
        {hasDerivedValues && (
          <DerivedValue>
            PR size {params.size} LOC (×{model.sizeMultiplier})
          </DerivedValue>
        )}
      </div>
      <QueueBox
        laneLabel={presentation.label}
        lane={lane}
        threshold={settings.threshold}
        tileClass={presentation.accentTileClass}
      />
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Icon name={presentation.reviewIcon} className={presentation.accentTextClass} />
          <p className="text-base">Review</p>
        </div>
        {presentation.reviewSliders.map(renderSlider)}
        {hasDerivedValues && <DerivedValue>Effective speed {params.effSpeed} LOC/hr</DerivedValue>}
        <LaneMetrics lane={lane} params={params} />
      </div>
    </section>
  )
}
