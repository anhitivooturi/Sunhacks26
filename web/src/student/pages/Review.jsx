import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Pip from '../components/Mascot.jsx'
import NoteMaker from '../components/NoteMaker.jsx'
import { MiniQuiz, Ring } from '../components/Quiz.jsx'
import { CountUp, Reveal, Skeleton } from '../components/ui.jsx'
import { loadReport, loadReview } from '../lib/api.js'
import { getTaps, getQuizResult, getStudentId } from '../lib/storage.js'
import { parseReason, confidenceFor } from '../lib/kinds.js'
import events from '@fixtures/events.json'

const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const CONF = { high: '#11935a', medium: '#b86e00', low: '#d62f1c' }

function Passage({ text, quote }) {
  const i = quote ? text.indexOf(quote) : -1
  if (i < 0) return <p className="text-[1.05rem] leading-relaxed">{text}</p>
  return <p className="text-[1.05rem] leading-relaxed">{text.slice(0, i)}<mark className="q">{quote}</mark>{text.slice(i + quote.length)}</p>
}

/* "Most replayed"-style graph of where the class got lost, with your own pins. */
function Heat({ report, mineIds, onPick }) {
  const W = 360, H = 170, top = 34, base = 128, dur = report.durationSec
  const x = t => (t / dur) * W
  const buckets = useMemo(() => {
    const n = Math.ceil(dur / 10), arr = Array(n).fill(0)
    if (report.sessionId === 'demo-session') {
      const sets = Array.from({ length: n }, () => new Set())
      events.forEach(e => { if (e.type === 'lost') sets[Math.min(n - 1, Math.floor(e.transcriptTsSec / 10))].add(e.studentId) })
      sets.forEach((st, i) => (arr[i] = st.size))
    } else report.moments.forEach(m => { const c = (m.startSec + m.endSec) / 2; for (let i = 0; i < n; i++) arr[i] += m.lostCount * Math.exp(-((i * 10 + 5 - c) ** 2) / (2 * 38 ** 2)) })
    return arr
  }, [report, dur])
  const max = Math.max(...buckets, 1)
  const pts = buckets.map((v, i) => [x(i * 10 + 5), base - (v / max) * (base - top)])
  const line = pts.reduce((d, p, i) => { if (!i) return `M0 ${base} L${p[0]} ${p[1]}`; const q = pts[i - 1], m = [(q[0] + p[0]) / 2, (q[1] + p[1]) / 2]; return d + ` Q${q[0]} ${q[1]} ${m[0]} ${m[1]}` }, '') + ` L${W} ${base}`
  const area = line + ` L${W} ${base} Z`
  const COL = ['#4cc2ff', '#ffb703', '#8b7bff', '#3ddc97']
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Graph of how many students were lost across the lecture">
      <defs>
        <linearGradient id="heatG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff5a47" stopOpacity=".85" /><stop offset="1" stopColor="#ff5a47" stopOpacity=".05" /></linearGradient>
        <clipPath id="heatClip"><rect className="heat-reveal" x="0" y="0" width={W} height={H} /></clipPath>
      </defs>
      {[0.33, 0.66, 1].map(f => <line key={f} x1="0" x2={W} y1={base - f * (base - top)} y2={base - f * (base - top)} stroke="#181a20" strokeOpacity=".1" strokeDasharray="3 4" />)}
      <g clipPath="url(#heatClip)">
        <path d={area} fill="url(#heatG)" />
        <path d={line.replace(` L${W} ${base}`, '')} fill="none" stroke="#d62f1c" strokeWidth="2.2" strokeLinejoin="round" />
      </g>
      {report.moments.map(m => {
        const cx = x((m.startSec + m.endSec) / 2), mine = mineIds.includes(m.id)
        return (
          <g key={m.id} className="pin-drop" style={{ cursor: 'pointer' }} onClick={() => onPick(m.id)} role="button" aria-label={`Jump to moment at ${mmss(m.startSec)}`}>
            <line x1={cx} x2={cx} y1={top - 8} y2={base} stroke="#181a20" strokeWidth="1.4" strokeDasharray="2 3" />
            <circle cx={cx} cy={top - 12} r="11" fill={mine ? '#ffe14d' : '#fff'} stroke="#181a20" strokeWidth="2.2" />
            <text x={cx} y={top - 7.5} textAnchor="middle" fontFamily="Caveat" fontWeight="700" fontSize="16" fill="#181a20">{mine ? '!' : '?'}</text>
            {mine && <text x={cx} y={top - 29} textAnchor="middle" fontFamily="Caveat" fontWeight="700" fontSize="15" fill="#d62f1c">you</text>}
          </g>
        )
      })}
      {report.topics.map((t, i) => (
        <g key={t.title}>
          <rect x={x(t.start) + 1} y={base + 8} width={x(t.end) - x(t.start) - 2} height="22" rx="6" fill={COL[i % 4]} fillOpacity=".28" stroke="#181a20" strokeOpacity=".7" strokeWidth="1.4" />
          <text x={(x(t.start) + x(t.end)) / 2} y={base + 23} textAnchor="middle" fontFamily="Inter" fontWeight="600" fontSize="8.5" fill="#181a20">{t.title}</text>
        </g>
      ))}
      <text x="2" y={H - 2} fontSize="8.5" fill="#5c606b" fontFamily="Inter">0:00</text>
      <text x={W - 2} y={H - 2} textAnchor="end" fontSize="8.5" fill="#5c606b" fontFamily="Inter">{mmss(dur)}</text>
    </svg>
  )
}

export default function Review() {
  const { sessionId } = useParams()
  const [state, setState] = useState({ loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    Promise.all([loadReport(sessionId), loadReview(sessionId, getStudentId())])
      .then(([r, rv]) => setState({ report: r.data, source: r.source, reviewIds: rv ? rv.map(m => m.id) : null }))
      .catch(e => setState({ error: e }))
  }, [sessionId])
  const { report } = state
  const { mine, demoAll } = useMemo(() => {
    if (!report) return {}
    if (state.reviewIds?.length) return { mine: report.moments.filter(m => state.reviewIds.includes(m.id)) } // server knows which moments this student tapped Lost on
    const lost = getTaps().filter(t => t.kind === 'lost')
    const hit = report.moments.filter(m => lost.some(t => t.at >= m.startSec - 5 && t.at <= m.endSec + 30))
    if (hit.length) return { mine: hit }
    if (lost.length) { const t = lost[lost.length - 1].at; return { mine: [[...report.moments].sort((a, b) => Math.abs(a.startSec - t) - Math.abs(b.startSec - t))[0]] } }
    return { mine: report.moments, demoAll: true }
  }, [report, tick, state.reviewIds])

  if (state.loading) return (
    <div className="paper"><div className="mx-auto max-w-3xl space-y-5 pb-24 pl-[3.6rem] pr-4 pt-10">
      <div className="flex items-center gap-3"><Pip size={60} mood="sleepy" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-8 w-2/3" /></div></div>
      <Skeleton className="h-48" /><Skeleton className="h-72" /></div></div>
  )
  if (state.error) return <div className="grid h-full place-items-center text-center"><div><Pip size={100} mood="worried" /><p className="mt-3">Couldn't open your notebook.</p><button className="mt-3 rounded-xl bg-hl px-4 py-2 font-bold text-ink" onClick={() => location.reload()}>Try again</button></div></div>

  const conf = report.moments.find(m => m.confidence)?.confidence || confidenceFor(report.participants)
  const myScore = m => { const r = getQuizResult(m.id); return r && !r.includes(null) ? r.filter(Boolean).length / m.quiz.length : null }
  const quizzed = report.moments.map(myScore).filter(v => v != null)
  const pick = id => document.getElementById('m-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const peak = Math.max(...report.moments.map(m => m.lostCount))

  return (
    <div className="paper">
      <main className="relative z-10 mx-auto max-w-3xl space-y-6 pb-24 pl-[3.6rem] pr-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Pip size={60} mood={mine.length ? 'worried' : 'cheer'} />
          <div className="min-w-0 flex-1">
            <p className="scribble text-2xl leading-none text-lost">your notebook</p>
            <h1 className="font-display text-[2rem] font-extrabold leading-[1.05]">You were <span className="hl">lost</span> here</h1>
          </div>
          <button onClick={() => window.print()} className="no-print ml-auto rounded-xl border-2 border-[#181a20] bg-white px-3 py-2 text-sm font-bold shadow-[2px_3px_0_#181a20]">Print</button>
        </header>
        {demoAll && <p className="no-print rounded-2xl border-2 border-dashed border-[#181a20]/30 p-3 text-sm muted">No Lost taps on this device, so here is every confusing moment from class.</p>}

        <Reveal>
          <section className="grid grid-cols-3 gap-2 text-center">
            {[[mine.length, '', 'moments you got lost'], [peak, '', 'classmates lost at the peak'], [quizzed.length ? Math.round((quizzed.reduce((a, b) => a + b, 0) / quizzed.length) * 100) : null, '%', 'quiz score']].map(([v, suf, l], i) => (
              <div key={i} className="glass rounded-2xl px-2 py-3"><p className="font-display text-3xl font-extrabold leading-none">{v == null ? '–' : <CountUp to={v} suffix={suf} />}</p><p className="mt-1 text-[11px] leading-tight muted">{l}</p></div>
            ))}
          </section>
        </Reveal>

        <Reveal delay={80}>
          <section className="glass print-break rounded-3xl p-4">
            <p className="scribble text-2xl leading-none text-lost">where the class lost the thread</p>
            <Heat report={report} mineIds={mine.map(m => m.id)} onPick={pick} />
            <p className="mt-1 text-center text-xs muted">tap a marker to jump to it</p>
          </section>
        </Reveal>

        <Reveal delay={60}>
          <section className="glass print-break rounded-3xl p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-extrabold">How confusing each topic was</h2>
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: CONF[conf] + '22', color: CONF[conf] }}>{conf} confidence · {report.participants} students participated</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {report.topics.map(t => {
                const ms = report.moments.filter(m => m.startSec >= t.start && m.startSec < t.end)
                const scored = ms.map(myScore).filter(v => v != null)
                const mineS = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null
                const after = mineS != null ? Math.max(0, t.confusion * (1 - mineS * 0.7)) : null
                const v = after ?? t.confusion
                return (
                  <div key={t.title} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                    <Ring value={v} color={v > 0.5 ? '#e0402c' : v > 0.25 ? '#e58a00' : '#16a36a'} />
                    <div className="min-w-0"><p className="truncate font-semibold">{t.title}</p>
                      <p className="text-xs muted">{mmss(t.start)}–{mmss(t.end)} · {t.questions} questions</p>
                      {after != null ? <p className="text-xs text-got">{Math.round(t.confusion * 100)}% → {Math.round(after * 100)}% after your quiz</p> : <p className="text-xs muted">Take a quiz below to update</p>}</div>
                  </div>
                )
              })}
            </div>
          </section>
        </Reveal>

        {mine.map((m, i) => {
          const why = parseReason(m)
          return (
            <Reveal key={m.id} delay={40}>
              <article id={'m-' + m.id} className="glass print-break space-y-4 rounded-3xl p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-extrabold muted">{mmss(m.startSec)}–{mmss(m.endSec)}</span>
                  <span className="rounded-full bg-lost/15 px-3 py-1 text-xs font-extrabold text-lost">{why.label}</span>
                  <span className="text-xs muted">{m.lostCount} of {m.active} students were lost here</span>
                </div>
                <div><p className="scribble mb-1 text-xl muted">what was said →</p><Passage text={m.passage} quote={m.evidenceQuote} /></div>
                {why.text && <p className="rounded-2xl bg-lost/8 p-3 text-sm"><b className="text-lost">Why it's confusing: </b>{why.text}</p>}
                <div><p className="scribble mb-1 text-xl text-got">ohh, so it's like this →</p><p className="text-[1.05rem] leading-relaxed">{m.reexplanation}</p></div>
                <div className="rounded-2xl border-2 border-dashed border-fast/30 bg-fast/8 p-4"><p className="scribble mb-1 text-xl text-fast">for example</p><p className="font-mono text-[.95em] leading-relaxed">{m.example}</p></div>
                <div className="rounded-2xl bg-white/5 p-4"><p className="scribble mb-2 text-xl muted">quick check</p>
                  <MiniQuiz moment={m} onDone={() => setTick(x => x + 1)} /></div>
                <NoteMaker sessionId={sessionId} moment={m} light />
              </article>
            </Reveal>
          )
        })}
        <Link to="/join" className="no-print block text-center text-sm muted underline">Back to join</Link>
      </main>
    </div>
  )
}
