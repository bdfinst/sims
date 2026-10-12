import { useEffect, useReducer } from 'react'
import { Header } from './components/Header.jsx'
import { HeadlineBand } from './components/HeadlineBand.jsx'
import { Lane } from './components/Lane.jsx'
import { TICK_MS } from './engine.js'
import { LANE_ORDER } from './laneConfig.js'
import { initialState, reducer } from './reducer.js'

function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { isRunning } = state

  useEffect(() => {
    if (!isRunning) return undefined
    const intervalId = setInterval(() => dispatch({ type: 'tick' }), TICK_MS)
    return () => clearInterval(intervalId)
  }, [isRunning])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState === 'hidden') dispatch({ type: 'pause' })
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <Header
        isRunning={isRunning}
        ticks={state.ticks}
        onToggleRunning={() => dispatch({ type: isRunning ? 'pause' : 'start' })}
      />
      <main className="flex flex-col gap-6">
        <HeadlineBand />
        {LANE_ORDER.map((laneId) => (
          <Lane
            key={laneId}
            laneId={laneId}
            lane={state.lanes[laneId]}
            settings={state.settings}
            onSettingChange={(key, value) => dispatch({ type: 'setSetting', key, value })}
          />
        ))}
      </main>
    </div>
  )
}

export default App
