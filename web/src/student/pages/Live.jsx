import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Pip from '../components/Mascot.jsx'
import Backdrop from '../components/Backdrop.jsx'
import StatusDot from '../components/StatusDot.jsx'
import TapButton from '../components/TapButton.jsx'
import SettingsPanel from '../components/SettingsPanel.jsx'
import QuizSheet from '../components/Quiz.jsx'
import { useSession } from '../lib/useSession.js'
import { KINDS } from '../lib/kinds.js'
import { USE_MOCK } from '../lib/connection.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import { burst, haptic, sfx } from '../lib/fx.js'
import { CountUp } from '../components/ui.jsx'

function Questions({ s, code }) {
  const [text, setText] = useState(''); const [voted, setVoted] = useState({})
  return (
    <div className="space-y-4 rise">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); s.ask(text); setText('') }}>
        <input value={text} onChange={e => setText(e.target.value)} maxLength={280} placeholder="Ask anonymously…" aria-label="Ask a question"
          className="min-w-0 flex-1 rounded-2xl border-2 border-chalk/20 bg-white/6 px-4 py-3 outline-none focus:border-hl" />
        <button disabled={!text.trim()} className="rounded-2xl bg-hl px-5 font-extrabold text-ink disabled:opacity-30">Ask</button>
      </form>
      <ul className="space-y-2">
        {s.questions.length === 0 && <li className="py-10 text-center muted"><Pip size={70} mood="sleepy" beat={false} className="mx-auto mb-2" />Nobody’s asked yet. What are you wondering?</li>}
        {s.questions.map((q, i) => {
          const id = q.id ?? q.questionId; const on = voted[id]
          return (
            <li key={id} className={`glass flex items-start gap-3 rounded-2xl p-3.5 ${q.answered ? 'opacity-50' : ''}`} style={{ animation: `rise .4s ${i * 40}ms both` }}>
              <button onClick={() => { if (!on) { s.upvote(id); setVoted(v => ({ ...v, [id]: 1 })); haptic(12) } }} aria-label={`Upvote: ${q.text.slice(0, 60)}`} aria-pressed={!!on}
                className={`chip-btn flex min-h-11 w-12 shrink-0 flex-col items-center rounded-xl py-1.5 text-sm font-bold transition active:scale-90 ${on ? 'bg-hl text-ink' : 'bg-white/10'}`}>
                <span>▲</span><span>{(q.upvotes ?? 0) + (on && !s.questions.length ? 1 : 0)}</span></button>
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
    <div className="space-y-3 rise">
      {lines.length === 0 && <p className="py-10 text-center muted">Captions appear here when the professor starts talking.</p>}
      {lines.map(l => <p key={l.startSec} className="cap transition-colors" style={{ color: l.final ? '#fff' : 'rgba(255,255,255,.45)' }}>{l.text}</p>)}
      <div ref={end} />
    </div>
  )
}

const POP = { lost: 'wait, what?!', slow: 'slow down!', fast: 'faster!', got_it: 'ohh, I see!' }
const MOOD = { lost: 'worried', slow: 'worried', fast: 'idle', got_it: 'cheer' }

export default function Live() {
  const { code } = useParams(); const nav = useNavigate()
  const s = useSession(code.toUpperCase())
  const [sp, setSp] = useSearchParams()
  const tab = ['tap', 'ask', 'cap', 'set'].includes(sp.get('tab')) ? sp.get('tab') : 'tap' // deep-linkable: ?tab=ask
  const setTab = id => setSp(id === 'tap' ? {} : { tab: id }, { replace: true })
  const [announce, setAnnounce] = useState('')
  usePageTitle(`Class ${code.toUpperCase()} · Wait, what?`)
  const [dismissed, setDismissed] = useState(null)
  const [pops, setPops] = useState([])
  const [flash, setFlash] = useState(null)
  const [mood, setMood] = useState('idle')
  const [saved, setSaved] = useState(0)
  const [na, setNa] = useState(false)
  const naT = useRef()
  const moodT = useRef()
  const waiting = s.status === 'connecting' || s.status === 'bad_code'
  const showFix = s.fix && dismissed !== s.fix.id
  const TABS = [['tap', 'Tap'], ['ask', 'Ask'], ['cap', 'Captions'], ['set', 'Settings']]

  const onTap = (id, pt) => {
    const ok = s.react(id); if (!ok) return false
    const k = KINDS.find(k => k.id === id)
    const n = id === 'lost' ? 12 : id === 'got_it' ? 7 : 0 // taps stay calm; the big confetti is saved for the quiz result
    if (n) burst({ x: pt.x, y: pt.y, count: n, speed: 7, colors: [k.color, '#f4f1e6', '#ffe14d'], glyph: id === 'lost' ? '?' : null, spread: Math.PI * 2 })
    setAnnounce(`${k.label} sent. Anonymous.`)
    sfx.tap(id)
    const pid = Math.random()
    setPops(p => [...p, { id: pid, x: Math.min(innerWidth - 90, Math.max(90, pt.x)), y: pt.y, text: POP[id], c: k.color }])
    setTimeout(() => setPops(p => p.filter(x => x.id !== pid)), 1300)
    setMood(MOOD[id]); clearTimeout(moodT.current); moodT.current = setTimeout(() => setMood('idle'), 1900)
    setFlash({ c: k.color, n: Date.now() })
    if (id === 'lost') { setSaved(n => n + 1); setNa(true); clearTimeout(naT.current); naT.current = setTimeout(() => setNa(false), 4500) }
    return true
  }
  const notAlone = na && s.meter && s.meter.lostCount > 1

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <a href="#tap-area" className="skip-link">Skip to the tap buttons</a>
      <h1 className="sr-only">Class {code.toUpperCase()}: tell your professor how it is going</h1>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      <Backdrop />
      {flash && <div key={flash.n} className="vig" style={{ '--c': flash.c }} />}
      {pops.map(p => <div key={p.id} className="pop" aria-hidden="true" style={{ left: p.x, top: p.y, '--c': p.c }}>{p.text}</div>)}
      <header className="relative z-10 flex items-center justify-between px-5 pb-1 pt-[max(.9rem,env(safe-area-inset-top))]">
        <button onClick={() => nav('/join')} className="flex min-h-11 items-center gap-2" aria-label="Leave class">
          <Pip size={40} beat={false} mood={mood} /><span className="font-display text-xl font-extrabold leading-none">Wait, <span className="hl">what?</span></span>
        </button>
        <div className="flex items-center gap-3"><StatusDot status={s.status} mock={USE_MOCK} />
          <span className="rounded-lg bg-chalk px-2.5 py-1 font-display text-sm font-extrabold tracking-[.2em] text-ink shadow-[0_3px_0_rgba(0,0,0,.45)]">{code.toUpperCase()}</span></div>
      </header>

      {s.status === 'reconnecting' && <p role="status" className="chip-in relative z-10 mx-4 mb-1 rounded-xl bg-slow px-3 py-2 text-center text-sm font-bold text-ink">Reconnecting… your taps are saved and will send when you are back.</p>}
      <main id="tap-area" className="relative z-10 min-h-0 flex-1 px-4 pb-6 pt-2" tabIndex={-1}>
        {tab === 'tap' && (
          <div className="relative h-full">
            <div className="grid h-full grid-cols-2 grid-rows-2 gap-5 sm:gap-6">
              {KINDS.map((k, i) => <TapButton key={k.id} kind={k} delay={120 + i * 90} coolUntil={s.cool[k.id] || 0} onTap={onTap} disabled={waiting} />)}
            </div>
            {notAlone && (
              <div className="chip-in pointer-events-none absolute inset-x-3 top-1/2 z-20 -translate-y-1/2 rounded-2xl border-[3px] border-ink bg-chalk px-4 py-3 text-center text-ink shadow-[0_6px_0_rgba(0,0,0,.5)]" role="status">
                <p className="font-display text-2xl font-extrabold leading-tight"><span className="text-lost"><CountUp to={s.meter.lostCount} ms={600} /></span> others are lost too</p>
                <p className="scribble text-xl leading-none opacity-70">you're not alone</p>
              </div>
            )}
            {waiting && (
              <div className="glass rise absolute inset-0 grid place-items-center rounded-[2rem] text-center" style={{ background: 'rgba(15,26,23,.86)' }}>
                <div><Pip size={110} mood="sleepy" /><p className="mt-3 font-display text-xl font-extrabold">{s.status === 'bad_code' ? "That code didn't work" : 'Pip is waking up…'}</p>
                  <p className="muted text-sm">{s.status === 'bad_code' ? 'Check the code on your professor’s screen, or ask them to show it again.' : 'Connecting to your class'}</p>
                  {s.status === 'bad_code' && <button className="mt-4 min-h-11 rounded-xl bg-hl px-5 py-2 font-bold text-ink" onClick={() => nav('/join')}>Re-enter code</button>}</div>
              </div>
            )}
          </div>
        )}
        {tab !== 'tap' && <div className="h-full overflow-y-auto pb-6">{tab === 'ask' ? <Questions s={s} code={code} /> : tab === 'cap' ? <Captions lines={s.lines} /> : <SettingsPanel />}</div>}
      </main>

      <footer className="relative z-10 px-4 pb-[max(.7rem,env(safe-area-inset-bottom))] pt-1">
        <nav className="glass mx-auto flex max-w-md items-center rounded-full p-1 text-sm" aria-label="Sections" role="tablist">
          {TABS.map(([id, l]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); haptic(8) }}
              className={`relative min-h-11 flex-1 rounded-full py-2.5 font-semibold transition-[background-color,color,box-shadow] duration-300 ${tab === id ? 'bg-hl text-ink shadow-[0_3px_0_#b89f10]' : 'muted'}`}>{l}
              {id === 'ask' && s.questions.length > 0 && tab !== 'ask' && <span className="absolute right-3 top-1.5 h-1.5 w-1.5 rounded-full bg-hl" />}</button>
          ))}
        </nav>
        <p className="mt-1.5 text-center text-xs muted">🔒 anonymous{saved > 0 && <> · <b className="tnum text-hl">{saved}</b> moment{saved > 1 ? 's' : ''} saved to your notebook</>}</p>
      </footer>

      {showFix && <QuizSheet moment={s.fix} onAnswer={(qi, c) => s.answer(s.fix.id, qi, c)} onClose={() => setDismissed(s.fix.id)} onReview={() => nav('/review/' + (s.sessionId || code.toUpperCase()))} />}
    </div>
  )
}
