import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Pip from '../components/Mascot.jsx'
import { burst, haptic, sfx } from '../lib/fx.js'

const OK = /[A-HJKMNP-Z]/
const Letters = ({ text, from = 0, cls = 'drop' }) => text.split('').map((c, i) => <span key={i} className={cls} style={{ '--d': (from + i * 0.045) + 's', display: 'inline-block' }}>{c === ' ' ? ' ' : c}</span>)

/* fake phone showing a looping tap demo — lots to look at on desktop */
function PhoneDemo() {
  const [tap, setTap] = useState(null)
  const [pop, setPop] = useState(null)
  const [count, setCount] = useState(0)
  const [lostCount, setLostCount] = useState(0)
  const kinds = [
    { id: 0, label: 'Lost', hint: 'wait, what?!', c: '#ff5a47', pop: 'wait, what?!' },
    { id: 1, label: 'Slow down', hint: 'too fast', c: '#ff9f1c', pop: 'slow down!' },
    { id: 2, label: 'Speed up', hint: 'too slow', c: '#4cc2ff', pop: 'faster!' },
    { id: 3, label: 'Got it', hint: 'ohh, I see', c: '#3ddc97', pop: 'ohh, I see!' },
  ]
  useEffect(() => {
    const seq = [0, 3, 0, 1, 0, 2, 3, 0]
    let i = 0, t
    const run = () => {
      const k = seq[i % seq.length]; i++
      setTap(k); setPop(kinds[k].pop)
      if (k === 0) { setLostCount(n => Math.min(14, n + Math.ceil(Math.random() * 3))); setCount(n => n + 1) }
      t = setTimeout(() => { setTap(null); setPop(null) }, 850)
      setTimeout(run, 1850)
    }
    const s = setTimeout(run, 1500)
    return () => { clearTimeout(s); clearTimeout(t) }
  }, [])
  return (
    <div className="phone-frame">
      <div className="phone-notch" />
      <div className="phone-screen">
        <div className="absolute inset-0 bg-ink" />
        {/* chalkboard mini */}
        <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #17302a 0%, #0f1a17 62%)' }} />
        <div className="relative flex h-full flex-col px-3 pb-3 pt-6">
          <div className="mb-2 flex items-center justify-between text-[10px] text-chalk/90">
            <div className="flex items-center gap-1.5"><Pip size={18} beat={false} /><span className="font-display font-extrabold">Wait, <span className="hl" style={{ padding: '0 .14em' }}>what?</span></span></div>
            <span className="rounded bg-chalk px-1.5 py-0.5 font-display text-[10px] font-extrabold text-ink">HACK</span>
          </div>
          <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-2">
            {kinds.map(k => (
              <div key={k.id} className="relative flex flex-col items-center justify-center rounded-2xl text-ink transition-all"
                style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${k.c} 100%, #fff 14%), ${k.c} 40%)`, boxShadow: tap === k.id ? `0 2px 0 ${k.c}80, inset 0 2px 0 rgba(255,255,255,.35)` : `0 5px 0 ${k.c}80, inset 0 2px 0 rgba(255,255,255,.35)`, transform: tap === k.id ? 'translateY(3px)' : 'none' }}>
                <span className="font-display text-sm font-extrabold">{k.label}</span>
                <span className="font-hand text-xs opacity-80">{k.hint}</span>
                {tap === k.id && <span className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(circle at 50% 60%, rgba(255,255,255,.8), transparent 70%)', animation: 'flash .6s ease-out' }} />}
              </div>
            ))}
          </div>
          {pop && <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-chalk px-3 py-0.5 font-hand text-sm font-bold text-ink shadow-[0_3px_0_rgba(0,0,0,.4)]" style={{ animation: 'popFloat .9s ease-out forwards' }}>{pop}</div>}
          {lostCount > 1 && tap === 0 && <div className="pointer-events-none absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl border-2 border-ink bg-chalk px-3 py-1 text-ink shadow-[0_4px_0_rgba(0,0,0,.5)]"><p className="text-center font-display text-[11px] font-extrabold leading-tight"><span className="text-lost">{lostCount}</span> others are lost too</p></div>}
          <div className="mt-2 flex items-center justify-center gap-1 rounded-full bg-chalk/10 px-2 py-1 text-[9px] text-chalk/70">
            <span className="h-1.5 w-1.5 rounded-full bg-got" />live · <b className="text-hl">{count}</b> moments saved
          </div>
        </div>
      </div>
      <div className="phone-glow" />
    </div>
  )
}

/* floating annotation pin */
function Pin({ x, y, delay = 0, text, color = '#ff5a47' }) {
  return (
    <div className="pin-note" style={{ left: x, top: y, '--d': delay + 's', '--c': color }}>
      <svg width="40" height="40" viewBox="0 0 40 40" className="pin-note-arrow"><path d="M4 4Q20 10 36 36" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 4" /><path d="M32 30l4 6-7 1z" fill={color} /></svg>
      <span className="pin-note-body font-hand" style={{ color }}>{text}</span>
    </div>
  )
}

export default function Join() {
  const { code: urlCode } = useParams()
  const nav = useNavigate()
  const [chars, setChars] = useState((urlCode || '').toUpperCase().replace(/[^A-Z]/g, '').split('').filter(c => OK.test(c)).slice(0, 4))
  const [launch, setLaunch] = useState(false)
  const [wide, setWide] = useState(typeof window !== 'undefined' ? innerWidth >= 900 : true)
  const refs = [useRef(), useRef(), useRef(), useRef()]
  const full = chars.length === 4
  const go = code => {
    if (launch) return
    setLaunch(true); haptic([20, 40, 20, 40, 60]); sfx.win()
    burst({ x: innerWidth / 2, y: innerHeight * 0.4, count: 90, speed: 15, spread: Math.PI * 2 })
    setTimeout(() => nav('/s/' + code), 750)
  }
  useEffect(() => { if (urlCode && full) { const t = setTimeout(() => go(chars.join('')), 600); return () => clearTimeout(t) } }, [])
  useEffect(() => { refs[Math.min(chars.length, 3)].current?.focus({ preventScroll: true }) }, []) // no autoFocus attr: it would scroll past the title
  useEffect(() => { const r = () => setWide(innerWidth >= 900); addEventListener('resize', r); return () => removeEventListener('resize', r) }, [])
  const put = (i, v) => {
    const clean = v.toUpperCase().split('').filter(c => OK.test(c))
    if (!clean.length) return
    haptic(10)
    const next = [...chars]; clean.slice(0, 4 - i).forEach((c, k) => (next[i + k] = c))
    setChars(next.slice(0, 4)); refs[Math.min(3, i + clean.length)].current?.focus()
  }

  return (
    <main className="hero">
      {/* animated background */}
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-aurora hero-aurora-1" />
        <div className="hero-aurora hero-aurora-2" />
        <div className="hero-aurora hero-aurora-3" />
        <div className="hero-grid" />
        <div className="hero-marks">
          {['?', 'wait…', 'what?', 'huh?', '?!', 'hold on', 'again?', '?', 'wait'].map((t, i) => <span key={i} style={{ '--i': i }}>{t}</span>)}
        </div>
      </div>

      <div className="hero-inner">
        {/* LEFT: wordmark + join form */}
        <section className="hero-left">
          <div className="hero-eyebrow spring">
            <span className="hero-dot" /> <span className="font-hand text-2xl">live during lecture</span>
          </div>

          <h1 className="hero-title" aria-label="Wait, what?">
            <span className="hero-title-row"><Letters text="Wait," /></span>
            <span className="hero-title-row hl-wrap"><span className="hl hero-hl"><Letters text="what?" from={0.3} /></span></span>
          </h1>

          <p className="hero-tag rise" style={{ animationDelay: '.9s' }}>
            Lost in lecture? <b>One tap.</b> Nobody knows it was you.<br />
            <span className="font-hand text-chalk/70 text-2xl">your professor sees <i>where</i> you got lost, not <i>who</i>.</span>
          </p>

          <form className="hero-form spring" style={{ '--d': '.5s' }} onSubmit={e => { e.preventDefault(); full && go(chars.join('')) }}>
            <label className="hero-form-label font-hand">enter the 4-letter code on the screen</label>
            <div className="hero-cells" role="group" aria-label="4-letter class code">
              {[0, 1, 2, 3].map(i => (
                <input key={i} ref={refs[i]} className="cell cell-hero" inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
                  maxLength={4} value={chars[i] || ''} aria-label={`Code letter ${i + 1}`}
                  style={chars[i] ? { transform: `rotate(${(i % 2 ? 1 : -1) * 1.6}deg)` } : undefined}
                  onChange={e => put(i, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Backspace') { e.preventDefault(); setChars(c => c.slice(0, i - (chars[i] ? 0 : 1) < 0 ? 0 : i - (chars[i] ? 0 : 1)).concat(c.slice(i + 1))); refs[Math.max(0, i - 1)].current?.focus() } }} />
              ))}
            </div>
            <button disabled={!full || launch} className={`hero-cta ${full && !launch ? 'glow-hl' : ''}`}>
              {launch ? "You're in →" : urlCode && full ? 'Joining…' : full ? 'Join the class →' : 'Enter the code'}
            </button>
            <button type="button" className="hero-demo-link font-hand" onClick={() => go('HACK')}>no class running? try the demo →</button>
          </form>

          <div className="hero-stats">
            {[['200+', 'students per lecture'], ['1 tap', 'nothing more'], ['0 logins', 'fully anonymous']].map(([n, l]) => (
              <div key={l} className="hero-stat"><p className="hero-stat-n font-display">{n}</p><p className="hero-stat-l font-hand">{l}</p></div>
            ))}
          </div>

          <p className="hero-foot">🔒 Anonymous by design · no accounts · no tracking · built in 24 hours</p>
        </section>

        {/* RIGHT: phone mockup with annotations (desktop only) */}
        {wide && (
          <section className="hero-right">
            <div className="hero-phone-wrap">
              <div className="hero-pip float"><Pip size={110} mood="cheer" /></div>
              <PhoneDemo />
              <Pin x="-30%" y="24%" delay={1.3} text="4 huge taps" color="#ffe14d" />
              <Pin x="52%" y="12%" delay={1.6} text="you stay anonymous" color="#3ddc97" />
              <Pin x="-34%" y="66%" delay={1.9} text="prof sees it live" color="#4cc2ff" />
              <Pin x="50%" y="76%" delay={2.2} text="haptics + confetti" color="#ff5a47" />
            </div>
          </section>
        )}
      </div>

      {/* loop strip bottom */}
      <div className="hero-loop" aria-hidden="true">
        <div className="hero-loop-track">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="hero-loop-set">
              <span>DETECT</span><em>·</em><span>EXPLAIN</span><em>·</em><span>FIX</span><em>·</em><span>VERIFY</span><em>·</em>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
