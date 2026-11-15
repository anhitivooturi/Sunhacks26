import { useMemo, useRef, useState } from 'react';

// One-series bar chart: peak share of students lost, per lecture, in date order.
// Rules followed (dataviz skill): single series = no legend (the title names it), one validated hue
// (#e5402e on paper, #f2503d on board), 4px rounded tops on a shared baseline, 2px gaps, recessive grid,
// hover tooltip on every bar with a hit target taller than the bar, and a table view.
export default function BarChart({ data, selectedId, onSelect, height = 220, label = 'Peak share of students lost' }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const wrap = useRef(null);
  const W = 1000;
  const H = height;
  const pad = { top: 12, right: 8, bottom: 28, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const n = Math.max(data.length, 1);
  const slot = innerW / n;
  const barW = Math.max(3, Math.min(36, slot - 2));
  const y = (v) => pad.top + innerH * (1 - Math.min(1, Math.max(0, v)));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.ceil(n / 8);

  const hovered = useMemo(() => data.find((d) => d.id === hover), [data, hover]);

  if (!data.length) return <p className="text-sm text-slate-500">No lectures yet. Start a class and its numbers show up here.</p>;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-slate-500">{label} · lower is better</span>
        <button onClick={() => setAsTable((t) => !t)} className="text-sm text-slate-500 underline-offset-2 hover:underline">
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="pb-2 font-semibold">Lecture</th><th className="pb-2 font-semibold">Date</th><th className="pb-2 text-right font-semibold">Peak lost</th></tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2"><button onClick={() => onSelect?.(d.id)} className="text-left hover:underline">{d.label}</button></td>
                <td className="py-2 text-slate-500">{d.date}</td>
                <td className="py-2 text-right tabular-nums">{Math.round(d.value * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={wrap} className="relative" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${label}, ${data.length} lectures`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" />
                <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-500 text-[11px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(t * 100)}%
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = pad.left + slot * i + slot / 2;
              const top = y(d.value);
              const h = Math.max(1, pad.top + innerH - top);
              const dim = selectedId && selectedId !== d.id;
              return (
                <g key={d.id}>
                  <path
                    d={roundedTop(cx - barW / 2, top, barW, h, Math.min(4, barW / 2))}
                    className={`fill-[#e5402e] dark:fill-[#f2503d] ${dim ? 'opacity-40' : ''}`}
                  />
                  {i % labelEvery === 0 && (
                    <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">{d.short}</text>
                  )}
                  {/* Hit target: the full column, much bigger than the bar. */}
                  <rect
                    x={pad.left + slot * i}
                    y={pad.top}
                    width={slot}
                    height={innerH}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHover(d.id)}
                    onFocus={() => setHover(d.id)}
                    onClick={() => onSelect?.(d.id)}
                    tabIndex={onSelect ? 0 : -1}
                    role={onSelect ? 'button' : undefined}
                    aria-label={`${d.label}, ${d.date}: ${Math.round(d.value * 100)}% lost at the worst moment`}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.(d.id)}
                  />
                </g>
              );
            })}
          </svg>
          {hovered && (
            <Tooltip x={(pad.left + slot * data.indexOf(hovered) + slot / 2) / W}>
              <div className="font-semibold">{hovered.label}</div>
              <div className="text-slate-500">{hovered.date}</div>
              <div className="mt-1 tabular-nums">
                <b>{Math.round(hovered.value * 100)}%</b> lost at the worst moment
              </div>
              {hovered.extra && <div className="text-slate-500">{hovered.extra}</div>}
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}

function Tooltip({ x, children }) {
  const left = `${Math.min(85, Math.max(15, x * 100))}%`;
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-[#fff] px-3 py-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
      style={{ left }}
      role="status"
    >
      {children}
    </div>
  );
}

// Bar with 4px rounded top corners and a square base on the baseline.
function roundedTop(x, y, w, h, r) {
  const rr = Math.min(r, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
