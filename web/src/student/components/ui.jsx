import { useEffect, useRef, useState } from 'react'

export function CountUp({ to = 0, ms = 900, suffix = '', decimals = 0 }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf, t0
    const step = t => { t0 ??= t; const k = Math.min(1, (t - t0) / ms); setV(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf)
  }, [to, ms])
  return <>{v.toFixed(decimals)}{suffix}</>
}

// scroll-reveal; content is visible by default and only animates once JS confirms it's offscreen
export function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(); const [state, setState] = useState('init')
  useEffect(() => {
    const el = ref.current; if (!el || !('IntersectionObserver' in window)) return
    const r = el.getBoundingClientRect()
    if (r.top < innerHeight * 0.92) return
    setState('hide')
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setState('show'); io.disconnect() } }, { threshold: 0.08 })
    io.observe(el); return () => io.disconnect()
  }, [])
  return <div ref={ref} className={`${state === 'hide' ? 'rv-hide' : state === 'show' ? 'rv-show' : ''} ${className}`} style={{ '--dl': delay + 'ms' }}>{children}</div>
}

export function Skeleton({ className = '' }) { return <div className={`skel ${className}`} /> }
