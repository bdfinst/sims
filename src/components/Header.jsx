const TITLE = 'AI vs. Human Code Review Simulator'
const DESCRIPTION =
  'Watch AI-speed code generation swamp human reviewers and push more defects into production.'
const ELAPSED_CAPTION = '1 s = 1 work hour'

export function Header() {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-3xl font-bold">{TITLE}</h1>
        <p className="text-base text-gray-300">{DESCRIPTION}</p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <button type="button" className="rounded bg-human px-4 py-2 text-base font-semibold">
            Start
          </button>
          <button
            type="button"
            className="rounded border border-gray-500 px-4 py-2 text-base font-semibold"
          >
            Reset
          </button>
          <span className="text-base text-gray-300">Paused</span>
        </div>
        <p className="text-base">
          <span className="text-xl font-semibold">0.0 work hours</span>{' '}
          <span className="text-gray-400">{ELAPSED_CAPTION}</span>
        </p>
      </div>
    </header>
  )
}
