const NO_RATIO = '—'

export function HeadlineBand() {
  return (
    <section className="flex flex-wrap items-baseline gap-4">
      <span data-metric="headline-ratio" className="text-6xl font-bold">
        {NO_RATIO}
      </span>
      <span className="text-base text-gray-300">more incidents per PR from AI-generated code</span>
    </section>
  )
}
