import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Pip from '../components/Mascot.jsx'
import NoteMaker from '../components/NoteMaker.jsx'
import StudentBar from '../components/StudentBar.jsx'
import StepRail from '../components/StepRail.jsx'
import { MiniQuiz, Ring } from '../components/Quiz.jsx'
import { CountUp, Reveal, Skeleton } from '../components/ui.jsx'
import { loadReport, loadReview } from '../lib/api.js'
import { getTaps, getQuizResult, getStudentId } from '../lib/storage.js'
import { parseReason, confidenceFor } from '../lib/kinds.js'
import { usePageTitle } from '../lib/usePageTitle.js'
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
          <g key={m.id} className="pin-drop" style={{ cursor: 'pointer' }} onClick={() => onPick(m.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(m.id) } }} role="button" tabIndex={0} aria-label={`Jump to the moment at ${mmss(m.startSec)}${mine ? ', where you were lost' : ''}`}>
            <rect x={cx - 32} y={top - 30} width="64" height={base - top + 30} fill="transparent" />
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
  usePageTitle('Your notebook · Wait, what?', '#fbf9f1')
  const [sp, setSp] = useSearchParams()
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

  const shell = children => <div className="paper"><StudentBar light>{children}</StudentBar></div>
  if (state.loading) return (
    <div className="paper"><StudentBar light /><div className="mx-auto max-w-3xl space-y-5 pb-24 pl-[3.6rem] pr-4 pt-8">
      <div className="space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-10 w-2/3" /></div>
      <div className="grid grid-cols-3 gap-2"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      <Skeleton className="h-48" /><Skeleton className="h-64" /></div></div>
  )
  if (state.error) return (
    <div className="paper"><StudentBar light /><div className="grid min-h-[70dvh] place-items-center px-6 text-center"><div>
      <Pip size={88} mood="worried" /><h1 className="display mt-3 text-2xl">Couldn’t open your notebook</h1>
      <p className="mt-1 text-slate-600">Check your connection, then try again. Your taps are saved on this phone.</p>
      <div className="mt-4 flex justify-center gap-3"><button className="btn-primary min-h-11" onClick={() => location.reload()}>Try again</button><Link to="/join" className="btn-ghost min-h-11">Back to join</Link></div>
    </div></div></div>
  )

  const conf = report.moments.find(m => m.confidence)?.confidence || confidenceFor(report.participants)
  const myScore = m => { const r = getQuizResult(m.id); return r && !r.includes(null) ? r.filter(Boolean).length / m.quiz.length : null }
  const quizzed = report.moments.map(myScore).filter(v => v != null)
  const peak = Math.max(...report.moments.map(m => m.lostCount))
  // the worst moment leads and the rest fold (same as the teacher's report); the open one lives in the URL (?m=)
  const worst = [...mine].sort((a, b) => b.score - a.score)[0]
  const wanted = sp.get('m')
  const openId = wanted === 'none' ? null : mine.some(m => m.id === wanted) ? wanted : worst?.id
  const select = id => { setSp(openId === id ? { m: 'none' } : { m: id }, { replace: true }) }
  const pick = id => { setSp({ m: id }, { replace: true }); setTimeout(() => document.getElementById('m-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60) }

  return (
    <div className="paper">
      <StudentBar light teacherLink={false}>
        <button onClick={() => window.print()} className="btn-ghost no-print min-h-11 text-sm">Print</button>
      </StudentBar>
      <main className="relative z-10 mx-auto max-w-3xl space-y-6 pb-20 pl-[3.6rem] pr-4 pt-6">
        <header className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="label">Your notebook · {mmss(report.durationSec)} lecture</p>
            <h1 className="display mt-1 text-3xl leading-[1.05] sm:text-4xl">You were <span className="hl">lost</span> {mine.length === 1 ? 'once' : `${mine.length} times`}</h1>
          </div>
          <Pip size={52} mood={mine.length ? 'worried' : 'cheer'} beat={false} />
        </header>
        {demoAll && <p className="no-print text-sm text-slate-600">No Lost taps on this device yet, so this shows every confusing moment from class.</p>}

        <section className="grid grid-cols-3 gap-2" aria-label="Summary">
          {[['Moments you got lost', mine.length, ''], ['Classmates lost at the peak', peak, ''], ['Your check score', quizzed.length ? Math.round((quizzed.reduce((a, b) => a + b, 0) / quizzed.length) * 100) : null, '%']].map(([l, v, suf]) => (
            <div key={l} className="card !p-3"><p className="label leading-tight">{l}</p><p className="display tnum mt-1 text-3xl">{v == null ? '–' : <CountUp to={v} suffix={suf} />}</p></div>
          ))}
        </section>

        <section className="card print-break">
          <p className="label">Where the class lost the thread</p>
          <Heat report={report} mineIds={mine.map(m => m.id)} onPick={pick} />
          <p className="no-print text-center text-xs text-slate-500">Tap a marker to open that moment</p>
        </section>

        <section className="section print-break" aria-labelledby="topics-h">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="topics-h" className="label">How confusing each topic was</h2>
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: CONF[conf] + '22', color: CONF[conf] }}>{conf} confidence · {report.participants} students</span>
          </div>
          <ul className="space-y-4">
            {report.topics.map(t => {
              const ms = report.moments.filter(m => m.startSec >= t.start && m.startSec < t.end)
              const scored = ms.map(myScore).filter(v => v != null)
              const mineS = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null
              const after = mineS != null ? Math.max(0, t.confusion * (1 - mineS * 0.7)) : null
              const v = after ?? t.confusion
              return (
                <li key={t.title}>
                  <div className="flex items-baseline justify-between gap-3"><span className="font-semibold">{t.title}</span><span className="tnum text-sm text-slate-600">{Math.round(v * 100)}% lost</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${Math.round(v * 100)} percent lost`}><div className="h-full rounded-full" style={{ width: `${Math.max(2, v * 100)}%`, background: v > 0.5 ? '#ff5a47' : v > 0.25 ? '#ff9f1c' : '#3ddc97' }} /></div>
                  <p className="mt-1 text-xs text-slate-500">{mmss(t.start)}–{mmss(t.end)} · {t.questions} questions{after != null && <> · <span className="font-semibold text-emerald-700">{Math.round(t.confusion * 100)}% → {Math.round(after * 100)}% after your check</span></>}</p>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="space-y-3" aria-label="Your moments">
          {mine.map(m => {
            const why = parseReason(m)
            const open = openId === m.id
            const sc = myScore(m)
            const steps = [
              { key: 'detect', title: 'Detect', value: `${m.lostCount}/${m.active} lost`, sub: `at ${mmss(m.startSec)}`, done: true },
              { key: 'explain', title: 'Explain', value: why.label, sub: 'from the lecture’s own words', done: true },
              { key: 'fix', title: 'Fix', value: 'Ready below', sub: 're-explanation + example', done: true },
              { key: 'verify', title: 'Verify', value: sc == null ? 'Your turn' : `${Math.round(sc * 100)}% correct`, sub: sc == null ? 'take the 3-question check' : `was ${Math.round((m.lostCount / m.active) * 100)}% lost`, done: sc != null },
            ]
            return (
              <article key={m.id} id={'m-' + m.id} className="moment card !p-0 print-break" data-rest={openId && !open ? 1 : 0}>
                <h2>
                  <button className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left" aria-expanded={open} aria-controls={'mb-' + m.id} onClick={() => select(m.id)}>
                    <span className="tnum rounded-full bg-lost px-3 py-1 text-sm font-bold text-ink">{mmss(m.startSec)}–{mmss(m.endSec)}</span>
                    <span className="min-w-0 flex-1"><span className="block font-bold">{why.label}</span><span className="tnum block text-sm text-slate-600">{m.lostCount} of {m.active} students were lost</span></span>
                    <span className="chev text-slate-500" aria-hidden="true">›</span>
                  </button>
                </h2>
                {open && (
                  <div id={'mb-' + m.id} className="space-y-5 border-t border-slate-200 p-5">
                    <StepRail light label="This moment, step by step" steps={steps} />
                    <div className="section"><p className="label mb-2">What was said</p><Passage text={m.passage} quote={m.evidenceQuote} /></div>
                    {why.text && <div className="section"><p className="label mb-1">Why it was confusing</p><p>{why.text}</p></div>}
                    <div className="section"><p className="label mb-1">Ready-made fix</p><p className="text-[1.05rem] leading-relaxed">{m.reexplanation}</p>
                      <p className="mt-3"><span className="label">Example </span><span className="font-mono text-[.95em]">{m.example}</span></p></div>
                    <div className="section"><p className="label mb-2">Check yourself</p><MiniQuiz moment={m} onDone={() => setTick(x => x + 1)} /></div>
                    <div className="section"><NoteMaker sessionId={sessionId} moment={m} light /></div>
                  </div>
                )}
              </article>
            )
          })}
        </section>
        <Link to="/join" className="btn-ghost no-print min-h-11">Back to join</Link>
      </main>
    </div>
  )
}
