import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Pip from '../components/Mascot.jsx'
import { StudentLogo } from '../components/StudentBar.jsx'
import { StatusDot } from '../../components/Chrome.jsx'
import TapButton from '../components/TapButton.jsx'
import SettingsSheet from '../components/SettingsSheet.jsx'
import QuizSheet from '../components/Quiz.jsx'
import { CountUp } from '../components/ui.jsx'
import { useSession } from '../lib/useSession.js'
import { KINDS } from '../lib/kinds.js'
import { USE_MOCK } from '../lib/connection.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import { store } from '../lib/storage.js'
import { burst, haptic, sfx } from '../lib/fx.js'

// One-tap questions (Parkinson's law: don't make a student type what they could tap).
const QUICK = ['Can you repeat that?', 'Can you show an example?', 'What does that term mean?']

function Questions({ s }) {
  const [text, setText] = useState(''); const [voted, setVoted] = useState({}); const [sent, setSent] = useState('')
  const send = t => { s.ask(t); setSent(t); haptic(12); setTimeout(() => setSent(''), 2200) }
  return (
    <div className="space-y-4 rise">
      <div>
        <p className="label mb-2">Ask in one tap</p>
        <div className="flex flex-wrap gap-2">{QUICK.map(q => <button key={q} className="qchip" onClick={() => send(q)}>{q}</button>)}</div>
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-got">{sent && `Sent anonymously: “${sent}”`}</p>
      </div>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (text.trim()) { send(text.trim()); setText('') } }}>
        <input value={text} onChange={e => setText(e.target.value)} maxLength={280} placeholder="Or type your own…" aria-label="Ask a question"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-hl" />
        <button disabled={!text.trim()} className="btn-primary min-h-11">Ask</button>
      </form>
      <ul className="space-y-2">
        {s.questions.length === 0 && <li className="py-8 text-center text-slate-400"><Pip size={64} mood="sleepy" beat={false} className="mx-auto mb-2" />Nobody’s asked yet. What are you wondering?</li>}
        {s.questions.map((q, i) => {
          const id = q.id ?? q.questionId; const on = voted[id]
          return (
            <li key={id} className={`card flex items-start gap-3 !p-3.5 ${q.answered ? 'opacity-50' : ''}`} style={{ animation: `rise .4s ${i * 40}ms both` }}>
              <button onClick={() => { if (!on) { s.upvote(id); setVoted(v => ({ ...v, [id]: 1 })); haptic(12) } }} aria-label={`Upvote: ${q.text.slice(0, 60)}`} aria-pressed={!!on}
                className={`chip-btn flex min-h-11 w-12 shrink-0 flex-col items-center rounded-xl py-1.5 text-sm font-bold transition active:scale-90 ${on ? 'bg-hl text-ink' : 'bg-white/10'}`}>
                <span aria-hidden="true">▲</span><span className="tnum">{(q.upvotes ?? 0) + (on && !s.questions.length ? 1 : 0)}</span></button>
              <p className="pt-1">{q.text}{q.answered && <span className="ml-2 text-xs text-got">✓ answered</span>}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Captions({ lines }) {
  const end = useRef()
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])
  return (
    <div className="space-y-3 rise" aria-live="off">
      {lines.length === 0 && <p className="py-10 text-center text-slate-400">Captions appear here when the professor starts talking.</p>}
      {lines.map(l => <p key={l.startSec} className="cap" style={{ color: l.final ? '#f4f1e6' : 'rgba(244,241,230,.45)' }}>{l.text}</p>)}
      <div ref={end} />
    </div>
  )
}

const GearIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)

const POP = { lost: 'wait, what?!', slow: 'slow down!', fast: 'faster!', got_it: 'ohh, I see!' }
const MOOD = { lost: 'worried', slow: 'worried', fast: 'idle', got_it: 'cheer' }
const TABS = [['tap', 'Tap'], ['ask', 'Ask'], ['cap', 'Captions']]

export default function Live() {
  const { code } = useParams(); const nav = useNavigate()
  const CODE = code.toUpperCase()
  const s = useSession(CODE)
  const [sp, setSp] = useSearchParams()
  const tab = TABS.some(([id]) => id === sp.get('tab')) ? sp.get('tab') : 'tap' // deep-linkable: ?tab=ask
  const setTab = id => setSp(id === 'tap' ? {} : { tab: id }, { replace: true })
  const [announce, setAnnounce] = useState('')
  const [dismissed, setDismissed] = useState(null)
  const [pops, setPops] = useState([])
  const [mood, setMood] = useState('idle')
  const [saved, setSaved] = useState(0)
  const [na, setNa] = useState(false)
  const [focusKind, setFocusKind] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const timers = useRef({})
  usePageTitle(`Class ${CODE} · Wait, what?`)
  useEffect(() => { store.set('pulse.lastClass', { code: CODE, at: Date.now() }) }, [CODE]) // lets the join page offer "Rejoin"
  const waiting = s.status === 'connecting' || s.status === 'bad_code'
  const showFix = s.fix && dismissed !== s.fix.id

  const onTap = (id, pt) => {
    const ok = s.react(id); if (!ok) return false
    const k = KINDS.find(k => k.id === id)
    const n = id === 'lost' ? 10 : id === 'got_it' ? 6 : 0 // taps stay calm; the big confetti is saved for milestones
    if (n) burst({ x: pt.x, y: pt.y, count: n, speed: 7, colors: [k.color, '#f4f1e6', '#ffe14d'], glyph: id === 'lost' ? '?' : null, spread: Math.PI * 2 })
    setAnnounce(`${k.label} sent. Anonymous.`)
    sfx.tap(id)
    const pid = Math.random()
    setPops(p => [...p, { id: pid, x: Math.min(innerWidth - 90, Math.max(90, pt.x)), y: pt.y, text: POP[id], c: k.color }])
    setTimeout(() => setPops(p => p.filter(x => x.id !== pid)), 1300)
    setMood(MOOD[id]); clearTimeout(timers.current.mood); timers.current.mood = setTimeout(() => setMood('idle'), 1900)
    // figure-ground: for a moment the tapped button is the figure and the other three step back
    setFocusKind(id); clearTimeout(timers.current.focus); timers.current.focus = setTimeout(() => setFocusKind(null), 1500)
    if (id === 'lost') { setSaved(n => n + 1); setNa(true); clearTimeout(timers.current.na); timers.current.na = setTimeout(() => setNa(false), 4500) }
    return true
  }
  const notAlone = na && s.meter && s.meter.lostCount > 1
  const dim = k => (notAlone ? true : focusKind != null && focusKind !== k)

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <a href="#tap-area" className="skip-link">Skip to the tap buttons</a>
      <h1 className="sr-only">Class {CODE}: tell your professor how it is going</h1>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {pops.map(p => <div key={p.id} className="pop" aria-hidden="true" style={{ left: p.x, top: p.y, '--c': p.c }}>{p.text}</div>)}

      <header className="relative z-10 flex items-center gap-2 border-b border-slate-800 px-3 py-1.5 pt-[max(.375rem,env(safe-area-inset-top))]">
        <StudentLogo compact mood={mood} />
        <span className="ml-auto rounded-lg border border-slate-700 px-2.5 py-1 font-display text-sm font-extrabold tracking-[.2em]" aria-label={`Class code ${CODE}`}>{CODE}</span>
        <button onClick={() => setSettingsOpen(true)} className="btn-ghost min-h-11 min-w-11 !px-0" aria-label="Settings" aria-haspopup="dialog"><GearIcon /></button>
      </header>

      <main id="tap-area" className="relative z-10 min-h-0 flex-1 px-4 pb-4 pt-3" tabIndex={-1} role="tabpanel" aria-label={TABS.find(([id]) => id === tab)[1]}>
        {tab === 'tap' && (
          <div className="relative h-full">
            <div className="grid h-full grid-cols-2 grid-rows-2 gap-5 sm:gap-6">
              {KINDS.map((k, i) => <TapButton key={k.id} kind={k} delay={120 + i * 90} dim={dim(k.id)} coolUntil={s.cool[k.id] || 0} onTap={onTap} disabled={waiting} />)}
            </div>
            {notAlone && (
              <div className="card chip-in pointer-events-none absolute inset-x-3 top-1/2 z-20 -translate-y-1/2 text-center shadow-xl" role="status">
                <p className="label">Your classmates</p>
                <p className="display text-3xl"><span className="tnum text-lost"><CountUp to={s.meter.lostCount} ms={600} /></span> others are lost too</p>
                <p className="hand text-lg text-slate-400">you’re not alone</p>
              </div>
            )}
            {waiting && (
              <div className="card rise absolute inset-0 grid place-items-center text-center" style={{ background: 'rgba(15,26,23,.94)' }}>
                <div><Pip size={96} mood="sleepy" /><p className="mt-3 display text-xl">{s.status === 'bad_code' ? 'That code didn’t work' : 'Pip is waking up…'}</p>
                  <p className="mt-1 text-sm text-slate-400">{s.status === 'bad_code' ? 'Check the code on your professor’s screen, or ask them to show it again.' : 'Connecting to your class'}</p>
                  {s.status === 'bad_code' && <button className="btn-primary mt-4 min-h-11" onClick={() => nav('/join')}>Re-enter code</button>}</div>
              </div>
            )}
          </div>
        )}
        {tab === 'ask' && <div className="h-full overflow-y-auto pb-4"><Questions s={s} /></div>}
        {tab === 'cap' && <div className="h-full overflow-y-auto pb-4"><Captions lines={s.lines} /></div>}
      </main>

      <footer className="relative z-10 px-4 pb-[max(.6rem,env(safe-area-inset-bottom))] pt-1">
        <nav className="mx-auto flex max-w-md gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1" aria-label="Sections" role="tablist">
          {TABS.map(([id, l]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); haptic(8) }}
              className={`relative min-h-11 flex-1 rounded-lg text-sm font-semibold transition-colors ${tab === id ? 'bg-slate-800 text-slate-50' : 'text-slate-400 hover:text-slate-100'}`}>{l}
              {id === 'ask' && s.questions.length > 0 && tab !== 'ask' && <span className="absolute right-3 top-2 h-1.5 w-1.5 rounded-full bg-hl" aria-label="new questions" />}</button>
          ))}
        </nav>
        {/* status lives in the page, not in a banner: banners get ignored (banner blindness) */}
        <p className="mx-auto mt-2 flex max-w-md flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-400">
          <StatusDot status={s.status === 'live' ? (USE_MOCK ? 'mock' : 'open') : s.status === 'reconnecting' ? 'reconnecting' : 'connecting'} />
          {s.status === 'reconnecting'
            ? <span role="status" className="font-semibold text-slow">Taps are saved and will send when you’re back.</span>
            : <span>Anonymous{saved > 0 && <> · <b className="tnum text-hl">{saved}</b> moment{saved > 1 ? 's' : ''} saved to your notebook</>}</span>}
        </p>
      </footer>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {showFix && <QuizSheet moment={s.fix} onAnswer={(qi, c) => s.answer(s.fix.id, qi, c)} onClose={() => setDismissed(s.fix.id)} onReview={() => nav('/review/' + (s.sessionId || CODE))} />}
    </div>
  )
}
