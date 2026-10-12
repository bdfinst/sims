import { useEffect, useReducer } from 'react'
import { Header } from './components/Header.jsx'
import { HeadlineBand } from './components/HeadlineBand.jsx'
import { Lane } from './components/Lane.jsx'
import { ResearchPanel } from './components/ResearchPanel.jsx'
import { OpenTipContext, useOpenTip } from './components/useOpenTip.js'
import { TICK_MS } from './engine.js'
import { LANE_ORDER } from './laneConfig.js'
import { ACTION, initialState, reducer } from './reducer.js'

function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const openTip = useOpenTip()
  const { isRunning } = state
  const changeSetting = (settingKey, value) =>
    dispatch({ type: ACTION.setSetting, settingKey, value })

  useEffect(() => {
    if (!isRunning) return undefined
    const intervalId = setInterval(() => dispatch({ type: ACTION.tick }), TICK_MS)
    return () => clearInterval(intervalId)
  }, [isRunning])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState === 'hidden') dispatch({ type: ACTION.pause })
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  return (
    <OpenTipContext value={openTip}>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4">
        <Header
          isRunning={isRunning}
          ticks={state.ticks}
          threshold={state.settings.threshold}
          onToggleRunning={() => dispatch({ type: isRunning ? ACTION.pause : ACTION.start })}
          onReset={() => dispatch({ type: ACTION.reset })}
          onSettingChange={changeSetting}
        />
        <main className="flex flex-col gap-3">
          <HeadlineBand lanes={state.lanes} />
          {LANE_ORDER.map((laneId) => (
            <Lane
              key={laneId}
              laneId={laneId}
              lane={state.lanes[laneId]}
              settings={state.settings}
              onSettingChange={changeSetting}
            />
          ))}
          <ResearchPanel />
        </main>
      </div>
    </OpenTipContext>
  )
}

export default App
