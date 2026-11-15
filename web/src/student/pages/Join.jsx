import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Pip from '../components/Mascot.jsx'
import { burst, celebrate, haptic, sfx } from '../lib/fx.js'
import { Reveal } from '../components/ui.jsx'
import StudentBar from '../components/StudentBar.jsx'
import StepRail from '../components/StepRail.jsx'
import { store } from '../lib/storage.js'
import { usePageTitle } from '../lib/usePageTitle.js'

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
              <div key={k.id} className="relative flex flex-col items-center justify-center rounded-2xl text-ink transition-[transform,box-shadow]"
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

const SPELLS = ['wait, what?', 'hi, I’m Pip', 'tap me again?', 'still lost? same.', 'I only have one eyebrow', 'ok ok, you found the secret']

const HOW = [
  { cls: 'b1', n: 1, name: 'Detect', body: 'Students tap Lost. Every tap is pinned to the exact second of the lecture, never to a name.', art: (
    <svg viewBox="0 0 320 96" className="w-full" aria-hidden="true"><path d="M0 84h70l14-8 12-52 14 60 16-30 12 12h182" fill="none" stroke="#ff5a47" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M0 84h70l14-8 12-52 14 60 16-30 12 12h182V96H0z" fill="#ff5a47" opacity=".12"/><circle cx="98" cy="24" r="7" fill="#ffe14d" stroke="#0f1a17" strokeWidth="2.5"/></svg>) },
  { cls: 'b2', n: 2, name: 'Explain', body: 'AI finds the exact words that lost the room and says why. The quote is always verbatim.', art: (
    <p className="text-lg leading-relaxed">So obviously <span className="evidence">the function needs a base case</span> and the stack unwinds.</p>) },
  { cls: 'b3', n: 3, name: 'Fix', body: 'A two-sentence re-explanation, one example and a 3-question check, sent to every phone.', art: (
    <div className="space-y-2" aria-hidden="true"><div className="h-3 w-4/5 rounded bg-slate-700" /><div className="h-3 w-3/5 rounded bg-slate-700" /><div className="mt-2 flex gap-2"><span className="h-7 w-16 rounded-lg bg-got/80" /><span className="h-7 w-16 rounded-lg bg-slate-700" /><span className="h-7 w-16 rounded-lg bg-slate-700" /></div></div>) },
  { cls: 'b4', n: 4, name: 'Verify', body: 'Quiz answers update the confusion score, shown with how many students it is based on.', art: (
    <div className="flex items-center gap-3 font-display text-2xl font-extrabold"><span className="tnum text-lost">70% lost</span><span className="text-slate-500" aria-hidden>→</span><span className="tnum text-got">100% clear</span></div>) },
]

export default function Join() {
  const { code: urlCode } = useParams()
  const nav = useNavigate()
  usePageTitle('Join your class · Wait, what?')
  const [chars, setChars] = useState((urlCode || '').toUpperCase().replace(/[^A-Z]/g, '').split('').filter(c => OK.test(c)).slice(0, 4))
  const [launch, setLaunch] = useState(false)
  const [hint, setHint] = useState('')
  const [shake, setShake] = useState(0)
  const [spell, setSpell] = useState(-1)
  const [wide, setWide] = useState(typeof window !== 'undefined' ? innerWidth >= 900 : true)
  const [look, setLook] = useState(null)
  const refs = [useRef(), useRef(), useRef(), useRef()]
  const heroRef = useRef()
  const full = chars.length === 4
  // Parkinson's law: don't make people retype what we already know. Offer the class they were in recently.
  const last = store.get('pulse.lastClass')
  const rejoin = last && Date.now() - last.at < 6 * 3600 * 1000 && last.code !== chars.join('') ? last.code : null

  const go = code => {
    if (launch) return
    setLaunch(true); haptic([20, 40, 20, 40, 60]); sfx.win()
    burst({ x: innerWidth / 2, y: innerHeight * 0.4, count: 70, speed: 13, spread: Math.PI * 2 })
    setTimeout(() => nav('/s/' + code), 750)
  }
  useEffect(() => { if (urlCode && full) { const t = setTimeout(() => go(chars.join('')), 600); return () => clearTimeout(t) } }, [])
  useEffect(() => { refs[Math.min(chars.length, 3)].current?.focus({ preventScroll: true }) }, []) // no autoFocus attr: it would scroll past the title
  useEffect(() => { const r = () => setWide(innerWidth >= 900); addEventListener('resize', r); return () => removeEventListener('resize', r) }, [])
  // design spell: the tab title calls you back
  useEffect(() => {
    let saved
    const vis = () => { if (document.hidden) { saved = document.title; document.title = 'Wait, what? Come back.' } else if (saved) document.title = saved }
    document.addEventListener('visibilitychange', vis); return () => document.removeEventListener('visibilitychange', vis)
  }, [])
  // cursor interaction (fine pointers only): Pip watches you, the phone leans toward you
  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches) return
    let raf
    const mv = e => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = heroRef.current; if (!el) return
        const nx = e.clientX / innerWidth, ny = e.clientY / innerHeight
        el.style.setProperty('--rx', ((ny - 0.5) * -8).toFixed(2) + 'deg'); el.style.setProperty('--ry', ((nx - 0.5) * 10).toFixed(2) + 'deg')
        setLook({ x: Math.max(-1, Math.min(1, (nx - 0.3) * 2)), y: Math.max(-1, Math.min(1, (ny - 0.3) * 2)) })
      })
    }
    addEventListener('pointermove', mv); return () => { removeEventListener('pointermove', mv); cancelAnimationFrame(raf) }
  }, [])

  const put = (i, v) => {
    const raw = v.toUpperCase().split('').filter(c => /\S/.test(c))
    const clean = raw.filter(c => OK.test(c))
    // never swallow keystrokes silently: say why a character was refused
    const refused = raw.filter(c => !OK.test(c))
    if (refused.length) setHint(refused.some(c => 'OIL'.includes(c)) ? 'Codes never use O, I or L, because they look like 0 and 1. Try the next letter.' : 'Codes are letters only.')
    else setHint('')
    if (!clean.length) return
    haptic(10)
    const next = [...chars]; clean.slice(0, 4 - i).forEach((c, k) => (next[i + k] = c))
    setChars(next.slice(0, 4)); refs[Math.min(3, i + clean.length)].current?.focus()
  }
  const submit = e => {
    e.preventDefault()
    if (full) return go(chars.join(''))
    // Vercel: don't pre-disable submit; surface the problem instead
    setHint('Enter all 4 letters from your professor’s screen.'); setShake(n => n + 1); haptic([40, 40, 40]); sfx.bad()
    refs[Math.min(chars.length, 3)].current?.focus()
  }
  const poke = e => {
    const n = spell + 1; setSpell(n % SPELLS.length); haptic(14)
    burst({ x: e.clientX || innerWidth * 0.2, y: e.clientY || innerHeight * 0.3, count: 8, speed: 6, glyph: '?', colors: ['#ffe14d', '#ff5a47', '#f4f1e6'] })
    if (n % SPELLS.length === SPELLS.length - 1) celebrate()
  }

  return (
    <>
    <StudentBar />
    <main className="hero" ref={heroRef}>
      <div className="hero-inner">
        <section className="hero-left">
          <h1 className="hero-title" aria-label="Wait, what?">
            <span className="hero-title-row" aria-hidden="true"><Letters text="Wait," /></span>
            <span className="hero-title-row hl-wrap" aria-hidden="true"><span className="hl hero-hl"><Letters text="what?" from={0.3} /></span></span>
          </h1>

          <p className="hero-tag rise" style={{ animationDelay: '.7s' }}>
            Lost in lecture? <b>Tap once.</b> Your professor sees <i>where</i> the class got lost, never <i>who</i>.
          </p>

          <form className="card hero-form spring" style={{ '--d': '.4s' }} onSubmit={submit} noValidate>
            <p className="label" id="code-label">Join a class</p>
            <div key={shake} className={`hero-cells ${shake ? 'shake' : ''}`} role="group" aria-labelledby="code-label" aria-describedby="code-hint">
              {[0, 1, 2, 3].map(i => (
                <input key={i} ref={refs[i]} className="cell cell-hero" inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
                  maxLength={4} value={chars[i] || ''} aria-label={`Code letter ${i + 1} of 4`}
                  style={chars[i] ? { transform: `rotate(${(i % 2 ? 1 : -1) * 1.6}deg)` } : undefined}
                  onChange={e => put(i, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Backspace') { e.preventDefault(); setChars(c => c.slice(0, i - (chars[i] ? 0 : 1) < 0 ? 0 : i - (chars[i] ? 0 : 1)).concat(c.slice(i + 1))); refs[Math.max(0, i - 1)].current?.focus() } }} />
              ))}
            </div>
            <p id="code-hint" role="status" aria-live="polite" className="hero-hint">{hint}</p>
            <button disabled={launch} className={`btn-primary min-h-[52px] w-full text-lg font-extrabold ${full ? '' : 'opacity-80'}`}>
              {launch ? 'You’re in →' : urlCode && full ? 'Joining…' : 'Join class'}
            </button>
            <div className="flex flex-wrap items-center gap-x-4">
              {rejoin && <button type="button" className="qchip" onClick={() => go(rejoin)}>Rejoin {rejoin}</button>}
              <button type="button" className="hero-demo-link font-hand" onClick={() => go('HACK')}>no class running? try the demo →</button>
            </div>
          </form>
        </section>

        {wide && (
          <section className="hero-right" aria-hidden="true">
            <div className="hero-phone-wrap">
              <div className="phone-tilt">
                <div className="hero-pip">
                  {spell >= 0 && <span key={spell} className="pip-say font-hand">{SPELLS[spell]}</span>}
                  <button type="button" className={`pip-btn ${spell >= 0 ? 'jump' : 'float'}`} key={'p' + spell} onClick={poke} tabIndex={-1} aria-hidden="true"><Pip size={96} mood={spell >= 0 ? 'cheer' : 'happy'} look={look} /></button>
                </div>
                <PhoneDemo />
              </div>
              <Pin x="-30%" y="24%" delay={1.1} text="4 huge taps" color="#ffe14d" />
              <Pin x="52%" y="66%" delay={1.5} text="you stay anonymous" color="#3ddc97" />
            </div>
          </section>
        )}
      </div>
    </main>

    <section className="how" aria-labelledby="how-h">
      <div className="mx-auto max-w-[1200px]">
        <Reveal><p className="label">How it works</p><h2 id="how-h" className="display mt-1 text-3xl sm:text-5xl" style={{ textWrap: 'balance' }}>One tap in. A fixed lecture out.</h2></Reveal>
        <div className="mt-5">
          <StepRail compact label="The loop" steps={HOW.map(h => ({ key: h.name, title: h.name, done: true }))} />
        </div>
        <ol className="bento mt-5">
          {HOW.map((h, i) => (
            <li key={h.n} className={h.cls}><Reveal className="h-full">
              <article className="card flex h-full flex-col gap-4">
                <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-hl text-sm font-bold text-ink" aria-hidden="true">{h.n}</span><h3 className="display text-2xl">{h.name}</h3></div>
                <div className="min-h-[72px]">{h.art}</div>
                <p className="text-slate-300">{h.body}</p>
              </article>
            </Reveal></li>
          ))}
        </ol>
        <p className="bento-hint" aria-hidden="true">Swipe for the next step →</p>
      </div>
    </section>

    <footer className="foot2">
      <div className="foot2-cols">
        <div><p className="label">Students</p><Link to="/join">Join a class</Link><Link to="/s/HACK">Try the demo</Link></div>
        <div><p className="label">Teachers</p><Link to="/host">Start a class</Link><Link to="/classes">Your classes</Link></div>
        <div><p className="label">The promise</p><p className="mt-2 text-slate-400">No accounts, no tracking. Your professor never sees who tapped.</p></div>
      </div>
      <p className="foot2-mark" aria-hidden="true">Wait, what?</p>
      <p className="foot2-small">Built in 24 hours at SunHacks 2026.</p>
    </footer>
    </>
  )
}
