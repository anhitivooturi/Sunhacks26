import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { TopBar, StatusDot } from '../components/Chrome.jsx';
import { createHostFeed } from '../lib/feed.js';
import { endSession } from '../lib/api.js';
import { fmtTime, heat, pct, WHY_LABELS } from '../lib/format.js';
import { loadSession } from './session.js';
import { startAudio } from './audio.js';

// The professor is teaching while this is on screen: calm colors, big type, nothing flashing.
export default function LiveScreen({ taMode = false }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { state } = useLocation();
  const session = state?.session || loadSession(id);
  const mode = state?.mode || 'transcribe';

  const [status, setStatus] = useState('connecting');
  const [meter, setMeter] = useState({ score: 0, lostCount: 0, active: 0 });
  const [lines, setLines] = useState([]); // [{ startSec, text, final }]
  const [questions, setQuestions] = useState([]);
  const [moments, setMoments] = useState([]);
  const [progress, setProgress] = useState({}); // momentId -> { answered, correctRate }
  const [pushed, setPushed] = useState({}); // momentId -> true
  const [checkSent, setCheckSent] = useState(false);
  const [ending, setEnding] = useState(false);
  const feedRef = useRef(null);

  useEffect(() => {
    if (!session) return;
    const feed = createHostFeed(session.code);
    feedRef.current = feed;
    const offs = [
      feed.on('status', setStatus),
      feed.on('meter', setMeter),
      feed.on('transcript', (t) =>
        setLines((prev) => {
          // Replace the partial for the same line, append otherwise. Keep the last 200 lines.
          const next = prev.filter((l) => !(l.startSec === t.startSec && !l.final));
          return [...next, t].slice(-200);
        })
      ),
      feed.on('questions', (q) => setQuestions(q.list || [])),
      feed.on('moment', ({ moment }) => setMoments((prev) => [...prev.filter((m) => m.id !== moment.id), moment])),
      feed.on('quiz_progress', (p) => setProgress((prev) => ({ ...prev, [p.momentId]: p }))),
    ];
    let stopAudio = () => {};
    if (!taMode) startAudio({ sessionId: session.id, mode }).then((stop) => (stopAudio = stop));
    return () => {
      offs.forEach((off) => off());
      feed.close();
      stopAudio();
    };
  }, [session?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const end = async () => {
    if (!confirm('End the session and build the report?')) return;
    setEnding(true);
    try {
      await endSession(session.id);
    } catch {
      /* the report page retries and shows errors */
    }
    nav(`/report/${session.id}`);
  };

  const pulseCheck = () => {
    feedRef.current?.send('pulse_check', {});
    setCheckSent(true);
    setTimeout(() => setCheckSent(false), 4000);
  };

  const pushFix = (m) => {
    feedRef.current?.send('push_fix', { momentId: m.id });
    setPushed((p) => ({ ...p, [m.id]: true }));
  };

  if (!session) {
    return (
      <div className="p-10 text-center">
        Session not found. <Link to="/host" className="text-pulse-500 underline">Start a new one</Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar>
        <span className="font-mono text-xl font-bold tracking-widest">
          {session.code}
        </span>
        <span className="hidden text-sm text-slate-500 md:inline">{session.joinUrl.replace(/^https?:\/\//, '')}</span>
        <img src={session.qrDataUrl} alt="" className="h-10 w-10 rounded bg-white p-0.5" />
        <StatusDot status={status} />
        {!taMode && (
          <>
            <a href={`/host/${session.id}/ta`} target="_blank" rel="noreferrer" className="btn-ghost text-sm">TA mode ↗</a>
            <button onClick={end} disabled={ending} className="btn-primary text-sm">
              {ending ? 'Ending…' : 'End session'}
            </button>
          </>
        )}
      </TopBar>

      <main className="grid min-h-0 flex-1 gap-5 p-5 lg:grid-cols-[minmax(340px,420px)_1fr]">
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto">
          <Meter meter={meter} />
          {!taMode && (
            <button onClick={pulseCheck} className="btn-ghost py-3 text-base">
              {checkSent ? '✓ Pulse check sent to phones' : 'Pulse check: “How clear was the last 10 minutes?”'}
            </button>
          )}
          <LiveMoments moments={moments} progress={progress} pushed={pushed} onPush={pushFix} readOnly={taMode} />
          <Questions questions={questions} onAnswered={(qid) => feedRef.current?.send('mark_answered', { questionId: qid })} />
        </div>
        <Transcript lines={lines} moments={moments} />
      </main>
    </div>
  );
}

function Meter({ meter }) {
  const h = heat(meter.score);
  const width = Math.min(100, Math.round(meter.score * 100));
  return (
    <section className="card">
      <div className="label">Confusion right now</div>
      <div className="mt-3 flex items-baseline gap-3">
        <span className={`text-6xl font-black tabular-nums ${h.text}`}>{meter.lostCount}</span>
        <span className="text-xl text-slate-500">of {meter.active} students lost</span>
      </div>
      <div className="mt-4 h-5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full rounded-full ${h.bar} transition-[width] duration-[1500ms] ease-out`} style={{ width: `${Math.max(width, 2)}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>Clear</span>
        <span>{pct(meter.score)}</span>
        <span>Lost</span>
      </div>
    </section>
  );
}

function LiveMoments({ moments, progress, pushed, onPush, readOnly }) {
  if (!moments.length) return null;
  return (
    <section className="card">
      <div className="label mb-3">Confusion moments so far</div>
      <ul className="space-y-3">
        {[...moments].reverse().map((m) => {
          const p = progress[m.id];
          return (
            <li key={m.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {fmtTime(m.startSec)} · {WHY_LABELS[m.whyConfusing]?.label || 'Confusing'}
                </span>
                <span className="text-sm text-slate-500">
                  {m.lostCount}/{m.active} lost
                </span>
              </div>
              {m.evidenceQuote && <p className="mt-1 text-sm italic text-slate-500">“{m.evidenceQuote}”</p>}
              {!readOnly && (
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={() => onPush(m)} disabled={pushed[m.id]} className="btn-primary px-3 py-1.5 text-sm">
                    {pushed[m.id] ? 'Fix pushed' : 'Push fix to phones'}
                  </button>
                  {p && (
                    <span className="text-sm text-slate-500">
                      {p.answered} answered · <b className="text-emerald-500">{pct(p.correctRate)}</b> correct
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Questions({ questions, onAnswered }) {
  const open = questions.filter((q) => !q.answered);
  return (
    <section className="card">
      <div className="label mb-3">Top questions</div>
      {!open.length && <p className="text-sm text-slate-500">No questions yet.</p>}
      <ul className="space-y-2">
        {open.slice(0, 6).map((q) => (
          <li key={q.id} className="flex items-start gap-3">
            <span className="mt-0.5 min-w-[2.5rem] rounded-lg bg-slate-100 px-2 py-1 text-center text-sm font-bold dark:bg-slate-800">▲ {q.upvotes}</span>
            <span className="flex-1 text-base">{q.text}</span>
            <button onClick={() => onAnswered(q.id)} className="text-sm text-slate-500 hover:text-emerald-500" title="Mark answered">
              ✓
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Transcript({ lines, moments }) {
  const ref = useRef(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const flagged = useMemo(() => {
    const set = new Set();
    lines.forEach((l) => {
      if (moments.some((m) => l.startSec >= m.startSec - 2 && l.startSec <= m.endSec)) set.add(l.startSec);
    });
    return set;
  }, [lines, moments]);

  return (
    <section className="card flex min-h-0 flex-col">
      <div className="label mb-3">Live transcript</div>
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2 text-xl leading-relaxed"
      >
        {!lines.length && <p className="text-base text-slate-500">Waiting for the lecture to start…</p>}
        {lines.map((l) => (
          <p
            key={`${l.startSec}-${l.final}`}
            className={`flex gap-4 rounded-lg px-2 py-1 ${flagged.has(l.startSec) ? 'bg-rose-500/10 ring-1 ring-rose-500/30' : ''}`}
          >
            <span className="w-12 shrink-0 pt-1 font-mono text-sm text-slate-400">{fmtTime(l.startSec)}</span>
            <span className={l.final ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>{l.text}</span>
            {flagged.has(l.startSec) && <span className="ml-auto shrink-0 pt-1 text-sm text-rose-500">● lost here</span>}
          </p>
        ))}
      </div>
    </section>
  );
}
