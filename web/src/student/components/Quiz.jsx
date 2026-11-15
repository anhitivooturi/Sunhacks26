import { useEffect, useState } from 'react'
import Pip from './Mascot.jsx'
import { CountUp } from './ui.jsx'
import { saveQuizResult, getQuizResult } from '../lib/storage.js'
import { parseReason } from '../lib/kinds.js'
import { burst, celebrate, haptic, sfx } from '../lib/fx.js'

const LET = ['A', 'B', 'C', 'D']

export function Ring({ value = 0, color = '#ff5a47', size = 64, label, animate = true, count }) {
  const r = 26, c = 2 * Math.PI * r
  const [v, setV] = useState(animate ? 0 : value)
  useEffect(() => { const t = setTimeout(() => setV(value), 80); return () => clearTimeout(t) }, [value])
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={r} stroke="currentColor" strokeOpacity=".16" strokeWidth="6" fill="none" />
      <circle cx="32" cy="32" r={r} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, v))} transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.9,.3,1)' }} />
      <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="800" fill="currentColor" fontFamily="Bricolage Grotesque">{label ?? (count != null ? Math.round(v * 100) + '%' : Math.round(value * 100) + '%')}</text>
    </svg>
  )
}

/** 3 questions, one at a time. onAnswer(qIndex, choice) fires for each (-> quiz_answer over the socket when live). */
export function MiniQuiz({ moment, onAnswer, onDone }) {
  const prev = getQuizResult(moment.id)
  const [i, setI] = useState(prev ? moment.quiz.length : 0)
  const [picked, setPicked] = useState(null)
  const [res, setRes] = useState(prev || [])
  const [streak, setStreak] = useState(0)
  const [bad, setBad] = useState(null)
  const q = moment.quiz[i]
  const total = moment.quiz.length
  const keyed = q ? typeof q.answerIndex === 'number' : true // pushed quizzes may omit answerIndex; the server scores them
  const unscored = res.some(r => r === null)
  if (!q) {
    const right = res.filter(Boolean).length
    if (unscored) return <div className="rise rounded-2xl bg-white/5 p-4 print-break"><p className="font-display text-lg font-extrabold">Answers sent.</p><p className="text-sm muted">Your professor scores them. The explanations are in your notebook.</p></div>
    return (
      <div className="rise flex items-center gap-4 rounded-2xl bg-white/5 p-4 print-break">
        <Ring value={right / total} color="#3ddc97" label={`${right}/${total}`} />
        <div><p className="font-display text-lg font-extrabold">{right === total ? 'Nailed it.' : right >= 2 ? 'Mostly there.' : 'Worth another look.'}</p>
          <p className="text-sm muted">You got {right} of {total} on this idea.</p>
          <button className="no-print mt-1 text-xs underline muted" onClick={() => { setI(0); setRes([]); setPicked(null); setStreak(0) }}>Retry</button></div>
      </div>
    )
  }
  const choose = (c, e) => {
    if (picked != null) return
    setPicked(c); onAnswer?.(i, c)
    const ok = keyed ? c === q.answerIndex : null
    const nextRes = [...res, ok]; setRes(nextRes)
    if (ok === null) { haptic(14) } else if (ok) {
      setStreak(n => n + 1); haptic([16, 30, 16]); sfx.good()
      const r = e.currentTarget.getBoundingClientRect()
      burst({ x: r.left + 40, y: r.top + r.height / 2, count: 26, speed: 10, spread: Math.PI * 1.4, angle: -Math.PI / 2 })
    } else { setStreak(0); setBad(c); haptic([60, 40, 60]); sfx.bad() }
    if (i === total - 1) { saveQuizResult(moment.id, nextRes); onDone?.(nextRes) }
  }
  return (
    <div key={i} className="rise space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-label={`Question ${i + 1} of ${total}`}>
          {moment.quiz.map((_, k) => <span key={k} className="h-2 flex-1 rounded-full transition-all duration-500" style={{ background: k < res.length ? (res[k] ? '#3ddc97' : '#ff5a47') : k === i ? 'currentColor' : 'rgba(128,128,128,.28)', opacity: k === i ? 0.9 : 1 }} />)}
        </div>
        {streak > 1 && <span className="chip-in rounded-full bg-hl px-2.5 py-0.5 text-xs font-extrabold text-ink">{streak} in a row</span>}
      </div>
      <h4 className="font-display text-xl font-extrabold leading-snug">{q.q}</h4>
      <div className="grid gap-2">
        {q.options.map((o, k) => {
          const state = picked == null ? '' : !keyed ? (k === picked ? 'sent' : 'dim') : k === q.answerIndex ? 'ok' : k === picked ? 'bad' : 'dim'
          return (
            <button key={k} onClick={e => choose(k, e)} disabled={picked != null}
              className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[.985] ${state === 'sent' ? 'border-violet bg-violet/25 okpop' : state === 'ok' ? 'border-got bg-got/15 okpop' : state === 'bad' ? 'border-lost bg-lost/15 shake' : state === 'dim' ? 'border-white/5 opacity-40' : 'border-white/15 bg-white/5 hover:bg-white/10'}`}>
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold">{LET[k]}</span><span>{o}</span>
            </button>
          )
        })}
      </div>
      {picked != null && (
        <div className="chip-in rounded-2xl bg-white/5 p-3 text-sm">{keyed ? <><b style={{ color: picked === q.answerIndex ? '#3ddc97' : '#ff5a47' }}>{picked === q.answerIndex ? 'Yes! ' : 'Almost. '}</b>{q.explanation}</> : <b>Answer sent.</b>}
          <button className="mt-3 block w-full rounded-xl bg-white py-2.5 font-bold text-black active:scale-[.98]" onClick={() => { setI(i + 1); setPicked(null); setBad(null) }}>{i === total - 1 ? 'See result' : 'Next'}</button></div>
      )}
    </div>
  )
}

/** Full-screen sheet shown when the professor pushes a fix. */
export default function QuizSheet({ moment, onAnswer, onClose, onReview }) {
  const [step, setStep] = useState('explain') // explain | quiz | done
  const [res, setRes] = useState([])
  const why = parseReason(moment)
  const right = res.filter(Boolean).length
  const unscored = res.some(r => r === null)
  useEffect(() => { haptic([30, 60, 30]) }, [])
  useEffect(() => { if (step === 'done' && (right >= 2 || unscored)) { celebrate(); sfx.win(); haptic([20, 40, 20, 40, 90]) } }, [step])
  const before = Math.round((moment.lostCount / moment.active) * 100)
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink" role="dialog" aria-modal="true" aria-label="Quick fix from your professor" style={{ animation: 'rise .45s cubic-bezier(.2,.9,.3,1) both' }}>
      <div className="board" style={{ position: 'absolute' }} />
      <div className="relative mx-auto flex min-h-full max-w-lg flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between"><span className="chip-in rounded-full bg-hl px-3 py-1 text-xs font-extrabold text-ink">From your professor</span>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-sm muted" aria-label="Close">Close ✕</button></div>
        <div className="my-4 flex justify-center"><div className={step === 'done' && (right >= 2 || unscored) ? 'jump' : ''}><Pip size={96} mood={step === 'done' ? (right >= 2 || unscored ? 'cheer' : 'worried') : step === 'quiz' ? 'idle' : 'happy'} /></div></div>
        {step === 'explain' && (
          <div className="space-y-4">
            <p className="scribble text-2xl text-fast">{why.label.toLowerCase()} · {before}% of the class felt this</p>
            <h2 className="rise font-display text-4xl font-extrabold leading-tight">Ohh. <span className="hl">That</span> part.</h2>
            <p className="rise text-lg leading-relaxed" style={{ animationDelay: '.15s' }}>{moment.reexplanation}</p>
            <div className="rise rounded-2xl border-2 border-dashed border-fast/50 bg-fast/10 p-4" style={{ animationDelay: '.3s' }}><p className="scribble mb-1 text-xl text-fast">for example</p><p className="font-mono text-[.95rem] leading-relaxed">{moment.example}</p></div>
            <button className="rise w-full rounded-2xl bg-hl py-4 font-display text-lg font-extrabold text-ink shadow-[0_5px_0_#b89f10] active:translate-y-1 active:shadow-none glow-hl" style={{ animationDelay: '.45s' }} onClick={() => { setStep('quiz'); haptic(15) }}>Check I got it →</button>
          </div>
        )}
        {step === 'quiz' && <MiniQuiz moment={moment} onAnswer={onAnswer} onDone={r => { setRes(r); setTimeout(() => setStep('done'), 1700) }} />}
        {step === 'done' && (
          <div className="space-y-5 text-center">
            {unscored ? (
              <h3 className="rise font-display text-4xl font-extrabold leading-none">Answers <span className="hl">sent</span>.</h3>
            ) : (<>
              <div className="spring mx-auto w-fit"><Ring size={132} value={right / 3} color="#3ddc97" label={`${right}/3`} /></div>
              <h3 className="rise font-display text-4xl font-extrabold leading-none" style={{ animationDelay: '.2s' }}>{right === 3 ? <>You <span className="hl">got</span> it.</> : right === 2 ? 'Almost there.' : 'Getting closer.'}</h3>
              <div className="rise glass mx-auto max-w-xs rounded-2xl p-4 text-left" style={{ animationDelay: '.4s' }}>
                <p className="scribble text-xl muted">this moment</p>
                <div className="mt-1 flex items-center gap-3 font-display text-2xl font-extrabold">
                  <span className="text-lost"><CountUp to={before} suffix="%" /> lost</span><span className="muted">→</span><span className="text-got"><CountUp to={Math.round((right / 3) * 100)} suffix="%" /> clear</span>
                </div>
                <p className="mt-1 text-xs muted">Your answers are anonymous. They help your professor see if the fix worked.</p>
              </div>
            </>)}
            <button className="rise w-full rounded-2xl bg-hl py-4 font-extrabold text-ink shadow-[0_5px_0_#b89f10] active:translate-y-1 active:shadow-none" style={{ animationDelay: '.55s' }} onClick={onReview}>Open my notebook →</button>
            <button className="w-full py-2 muted" onClick={onClose}>Back to class</button>
          </div>
        )}
      </div>
    </div>
  )
}
