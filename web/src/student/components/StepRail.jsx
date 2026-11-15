// Connectedness: the steps of a flow are joined by a line, and the finished ones light up.
// Same look as the teacher report's Detect > Explain > Fix > Verify bar (report/MomentPanel.jsx), made to work in a narrow phone column.
const dot = (state, light) =>
  state === 'done' ? 'bg-got text-ink'
  : state === 'current' ? 'bg-hl text-ink ring-4 ring-hl/30'
  : light ? 'border-2 border-slate-300 bg-white text-slate-400' : 'border-2 border-slate-700 bg-slate-900 text-slate-400'

export default function StepRail({ steps, light = false, compact = false, label = 'Steps' }) {
  const current = steps.findIndex(s => !s.done)
  const line = (done, next) => (next?.done ? 'bg-got' : done ? 'bg-got/60' : light ? 'bg-slate-300' : 'bg-slate-700')

  if (compact) {
    return (
      <ol className="flex items-center gap-2" aria-label={label}>
        {steps.map((s, i) => {
          const state = s.done ? 'done' : i === current ? 'current' : 'todo'
          return (
            <li key={s.key} className={`flex items-center gap-2 ${i < steps.length - 1 ? 'flex-1' : ''}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dot(state, light)}`}>{state === 'done' ? '✓' : i + 1}</span>
              <span className={`label whitespace-nowrap ${steps.length > 3 ? 'sr-only min-[440px]:not-sr-only' : ''} ${state === 'todo' ? 'opacity-60' : ''}`}>{s.title}</span>
              {i < steps.length - 1 && <span aria-hidden className={`h-0.5 min-w-3 flex-1 rounded ${line(s.done, steps[i + 1])}`} />}
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol className="grid grid-cols-1 gap-0 lg:grid-cols-4" aria-label={label}>
      {steps.map((s, i) => {
        const state = s.done ? 'done' : i === current ? 'current' : 'todo'
        const next = steps[i + 1]
        return (
          <li key={s.key} className="relative flex items-start gap-3 pb-5 pr-4 last:pb-0 lg:pb-0" aria-current={state === 'current' ? 'step' : undefined}>
            {next && <span aria-hidden className={`absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-0.5 lg:left-10 lg:right-0 lg:top-4 lg:h-0.5 lg:w-auto ${line(s.done, next)}`} />}
            <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-500 ${dot(state, light)}`}>{state === 'done' ? '✓' : i + 1}</span>
            <span className="relative z-10 min-w-0">
              <span className="label block">{s.title}</span>
              <span className={`block font-bold ${state === 'todo' ? 'opacity-50' : ''}`}>{s.value}</span>
              {s.sub && <span className="block text-xs opacity-60">{s.sub}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
