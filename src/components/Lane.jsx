import { LANE_MODELS, laneParams } from '../engine.js'
import { COLOR_CLASS, LANE_PRESENTATION, TILE_CAPACITY, TYPE_CLASS } from '../laneConfig.js'
import { Icon } from './Icon.jsx'
import { LaneMetrics } from './LaneMetrics.jsx'
import { QueueBox } from './QueueBox.jsx'
import { RateSlider } from './RateSlider.jsx'

function DerivedValue({ children }) {
  return (
    <p className={`${TYPE_CLASS.label} ${COLOR_CLASS.mutedText}`}>
      {children}{' '}
      <span
        className={`rounded px-1 uppercase tracking-wide ${COLOR_CLASS.tag} ${TYPE_CLASS.label}`}
      >
        derived
      </span>
    </p>
  )
}

export function Lane({ laneId, lane, settings, onSettingChange }) {
  const presentation = LANE_PRESENTATION[laneId]
  const model = LANE_MODELS[laneId]
  const params = laneParams(settings, model)
  const hasDerivedSize = model.sizeMultiplier !== 1
  const hasDerivedSpeed = model.skimApplies
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
      className={`grid gap-3 rounded border-t-4 p-3 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_20rem] ${COLOR_CLASS.lanePanel} ${presentation.accentBorderClass}`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Icon name={presentation.generationIcon} className={presentation.accentTextClass} />
          <h2 className={TYPE_CLASS.value}>{presentation.label}</h2>
        </div>
        {presentation.generationSliders.map(renderSlider)}
        {hasDerivedSize && (
          <DerivedValue>
            PR size {params.size} LOC (×{model.sizeMultiplier})
          </DerivedValue>
        )}
      </div>
      <QueueBox
        laneLabel={presentation.label}
        lane={lane}
        threshold={settings.threshold}
        capacity={TILE_CAPACITY}
        accentClass={presentation.accentTileClass}
      />
      {/* On wide screens this wrapper dissolves, so the controls and the metrics are separate columns. */}
      <div className="flex flex-col gap-2 lg:contents">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Icon name={presentation.reviewIcon} className={presentation.accentTextClass} />
            <p className={TYPE_CLASS.label}>Review</p>
          </div>
          {presentation.reviewSliders.map(renderSlider)}
          {hasDerivedSpeed && <DerivedValue>Effective speed {params.effSpeed} LOC/hr</DerivedValue>}
        </div>
        <LaneMetrics lane={lane} params={params} />
      </div>
    </section>
  )
}
