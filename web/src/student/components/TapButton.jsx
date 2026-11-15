import { useEffect, useState } from 'react'
import { haptic } from '../lib/fx.js'

const GLYPH = {
  lost: <><circle cx="32" cy="32" r="24" strokeDasharray="4 6"/><path d="M24 25c1-6 7-9 12-6 5 3 4 9 0 12-3 2-4 3-4 7"/><circle cx="32" cy="47" r=".5" fill="currentColor"/></>,
  slow: <><path d="M36 14 18 32l18 18"/><path d="M52 14 34 32l18 18" opacity=".45"/></>,
  fast: <><path d="M28 14l18 18-18 18"/><path d="M12 14l18 18-18 18" opacity=".45"/></>,
  got_it: <><circle cx="32" cy="32" r="24"/><path d="M20 33l8 8 16-17"/></>,
}

export default function TapButton({ kind, coolUntil, onTap, disabled, delay = 0 }) {
  const [ripples, setRipples] = useState([])
  const [flash, setFlash] = useState(0)
  const [, tick] = useState(0)
  const cooling = coolUntil > Date.now()
  useEffect(() => { if (!cooling) return; const t = setTimeout(() => tick(x => x + 1), coolUntil - Date.now() + 30); return () => clearTimeout(t) }, [coolUntil, cooling])
  const fire = (e, keyboard = false) => {
    if (disabled || cooling) return
    const r = e.currentTarget.getBoundingClientRect()
    const cx = keyboard ? r.left + r.width / 2 : e.clientX, cy = keyboard ? r.top + r.height / 2 : e.clientY
    const ok = onTap(kind.id, { x: cx, y: cy }); if (!ok) return
    const id = Math.random()
    setRipples(x => [...x, { id, x: cx - r.left, y: cy - r.top }])
    setTimeout(() => setRipples(x => x.filter(i => i.id !== id)), 800)
    setFlash(f => f + 1)
    haptic(kind.id === 'lost' ? [22, 46, 22] : 20)
  }
  return (
    <button
      className="tap spring flex flex-col items-center justify-center gap-2"
      style={{ '--c': kind.color, '--d': delay + 'ms' }} data-cool={cooling ? 1 : 0} disabled={disabled}
      onPointerDown={fire} onClick={e => { if (e.detail === 0) fire(e, true) }} /* detail 0 = keyboard Enter/Space */ aria-label={`${kind.label}: ${kind.hint}`} aria-disabled={cooling}
    >
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">{ripples.map(r => <span key={r.id} className="ripple" style={{ left: r.x, top: r.y }} />)}</span>
      <svg className="glyph" viewBox="0 0 64 64" width="38%" style={{ maxWidth: 110 }} fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">{GLYPH[kind.id]}</svg>
      <span className="font-display text-[clamp(1.6rem,7vw,2.6rem)] font-extrabold leading-none tracking-tight">{kind.label}</span>
      <span className="scribble h-6 text-xl leading-6 opacity-80">
        {cooling ? <span key={flash} className="sent-badge inline-block">✓ got it, noted</span> : kind.hint}
      </span>
    </button>
  )
}
