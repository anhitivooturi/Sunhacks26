import { fmtTime, heat } from '../lib/format.js';

// The lecture as one horizontal strip: topic segments colored by confusion, moments as markers.
export default function Timeline({ report, selected, onSelect }) {
  const dur = Math.max(report.durationSec, 1);
  const x = (sec) => `${(Math.min(Math.max(sec, 0), dur) / dur) * 100}%`;

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between">
        <div className="label">Lecture timeline</div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Legend cls="bg-emerald-500" label="Clear" />
          <Legend cls="bg-amber-400" label="Some confusion" />
          <Legend cls="bg-rose-500" label="Lost" />
        </div>
      </div>

      <div className="relative pt-8">
        {/* Moment markers above the strip */}
        {report.moments.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="group absolute top-0 -translate-x-1/2"
            style={{ left: x((m.startSec + m.endSec) / 2) }}
            title={`${fmtTime(m.startSec)} – ${Math.round(m.score * 100)}% lost`}
          >
            <span
              className={`block rounded-full px-2 py-0.5 text-xs font-bold text-white ${heat(m.score).bar} ${selected === m.id ? 'ring-4 ring-pulse-500/40' : ''}`}
            >
              {fmtTime(m.startSec)}
            </span>
            <span className={`mx-auto block h-3 w-0.5 ${heat(m.score).bar}`} />
          </button>
        ))}

        <div className="relative flex h-14 overflow-hidden rounded-xl">
          {report.topics.map((t) => {
            const h = heat(t.confusion);
            return (
              <div
                key={t.start}
                className={`relative flex items-center border-r-2 border-white/60 px-3 dark:border-slate-950/60 ${h.soft}`}
                style={{ width: `${((t.end - t.start) / dur) * 100}%` }}
              >
                <div className={`absolute inset-x-0 bottom-0 h-1.5 ${h.bar}`} />
                <span className="pointer-events-none relative z-10 truncate text-sm font-semibold drop-shadow-sm">{t.title}</span>
              </div>
            );
          })}
          {/* Moment spans drawn over the topics */}
          {report.moments.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={`absolute inset-y-0 ${heat(m.score).bar} ${selected === m.id ? 'opacity-90' : 'opacity-60 hover:opacity-80'}`}
              style={{ left: x(m.startSec), width: `max(6px, ${((m.endSec - m.startSec) / dur) * 100}%)` }}
              aria-label={`Moment at ${fmtTime(m.startSec)}`}
            />
          ))}
        </div>

        <div className="mt-1 flex justify-between font-mono text-xs text-slate-500">
          <span>0:00</span>
          <span>{fmtTime(dur / 2)}</span>
          <span>{fmtTime(dur)}</span>
        </div>
      </div>
    </section>
  );
}

function Legend({ cls, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
      {label}
    </span>
  );
}
