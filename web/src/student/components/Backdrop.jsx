const MARKS = [['?', '9%', '14%', '5.5rem', 34, 0, '-10deg'], ['wait…', '62%', '30%', '3.2rem', 44, 8, '6deg'], ['?!', '82%', '8%', '4.5rem', 38, 15, '12deg'], ['what?', '26%', '55%', '3rem', 50, 3, '-6deg'], ['?', '70%', '70%', '6rem', 40, 20, '-14deg'], ['huh', '8%', '82%', '3.2rem', 46, 11, '8deg']]
export default function Backdrop() {
  return (
    <div className="board" aria-hidden="true">
      {MARKS.map(([t, l, top, s, d, w, r], i) => <b key={i} style={{ left: l, top, '--s': s, '--d': d + 's', '--w': -w + 's', '--r': r, fontSize: s }}>{t}</b>)}
    </div>
  )
}
