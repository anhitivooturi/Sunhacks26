import { useEffect, useState } from 'react'

export function CountUp({ to = 0, ms = 900, suffix = '', decimals = 0 }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf, t0
    const step = t => { t0 ??= t; const k = Math.min(1, (t - t0) / ms); setV(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf)
  }, [to, ms])
  return <span className="tnum">{v.toFixed(decimals)}{suffix}</span>
}

// Scroll reveal as a CSS scroll-driven animation (progressive enhancement): content is always in the DOM and visible by default;
// supporting browsers fade it up as it enters the viewport. No JS observer, so print, screenshots and slow devices never see blank sections.
export function Reveal({ children, className = '' }) {
  return <div className={`rv ${className}`}>{children}</div>
}

export function Skeleton({ className = '' }) { return <div className={`skel ${className}`} /> }
