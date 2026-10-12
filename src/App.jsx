import { Header } from './components/Header.jsx'
import { HeadlineBand } from './components/HeadlineBand.jsx'
import { Lane } from './components/Lane.jsx'
import { LANE_ORDER } from './laneConfig.js'

function App() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <Header />
      <main className="flex flex-col gap-6">
        <HeadlineBand />
        {LANE_ORDER.map((laneId) => (
          <Lane key={laneId} laneId={laneId} />
        ))}
      </main>
    </div>
  )
}

export default App
