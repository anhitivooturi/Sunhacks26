import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { TopBar, StatusDot } from '../components/Chrome.jsx';
import { createHostFeed } from '../lib/feed.js';
import { endSession } from '../lib/api.js';
import { fmtTime, heat, pct, WHY_LABELS } from '../lib/format.js';
import { loadSession } from './session.js';
import { startAudio } from './audio.js';
import { useTitle } from '../lib/theme.js';

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
  const [spotlight, setSpotlight] = useState(null); // momentId highlighted for a few seconds after it arrives
  const feedRef = useRef(null);
  const spotTimer = useRef(null);
  useEffect(() => () => clearTimeout(spotTimer.current), []);

  useEffect(() => {
    if (!session) return;
    const feed = createHostFeed(session.code);
    feedRef.current = feed;
    const offs = [
      feed.on('status', setStatus),
      feed.on('meter', setMeter),
      feed.on('transcript', (t) =>
        setLines((prev) => {
          // One line per start time: a final replaces its partial, and a repeated start time (lecture loop,
          // server resend) replaces the old line instead of duplicating it. Keep the last 200 lines.
          const next = prev.filter((l) => l.startSec !== t.startSec);
          return [...next, t].slice(-200);
        })
      ),
      feed.on('questions', (q) => setQuestions(q.list || [])),
      feed.on('moment', ({ moment }) => {
        setMoments((prev) => {
          if (!prev.some((m) => m.id === moment.id)) {
            // New moment: spotlight it and dim everything else for a few seconds.
            setSpotlight(moment.id);
            clearTimeout(spotTimer.current);
            spotTimer.current = setTimeout(() => setSpotlight(null), 5000);
          }
          return [...prev.filter((m) => m.id !== moment.id), moment];
        });
      }),
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

  // Two-step end inside the button itself (no browser pop-up): first click asks, second click ends.
  // It quietly resets after 4 s so a stray click never ends a lecture.
  const [confirmEnd, setConfirmEnd] = useState(false);
  const confirmTimer = useRef(null);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);
  const askEnd = () => {
    setConfirmEnd(true);
    clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmEnd(false), 4000);
  };

  const end = async () => {
    clearTimeout(confirmTimer.current);
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
        This session isn’t on this device anymore. <Link to="/host" className="text-pulse-500 underline">Start a new session</Link>
      </div>
    );
  }

  const newest = moments[moments.length - 1];

  return (
    <div className="flex h-screen flex-col">
      <TitleSync taMode={taMode} code={session.code} lost={meter.lostCount} />
      {/* Screen readers hear new confusion moments without the screen changing focus. */}
      <div aria-live="polite" className="sr-only">
        {newest ? `New confusion moment at ${fmtTime(newest.startSec)}: ${WHY_LABELS[newest.whyConfusing]?.label || 'confusing passage'}.` : ''}
      </div>
      <TopBar>
        <span translate="no" className="display text-2xl tracking-widest">
          {session.code}
        </span>
        <span className="hidden text-sm text-slate-500 md:inline">{session.joinUrl.replace(/^https?:\/\//, '')}</span>
        <img src={session.qrDataUrl} alt={`QR code to join ${session.code}`} width="40" height="40" className="h-10 w-10 rounded bg-white p-0.5" />
        <StatusDot status={status} />
        {!taMode && (
          <>
            <a href={`/host/${session.id}/ta`} target="_blank" rel="noreferrer" className="btn-ghost text-sm">TA mode ↗</a>
            {confirmEnd ? (
              <span className="pop-in flex items-center gap-2">
                <button onClick={end} disabled={ending} className="btn-primary text-sm">
                  {ending ? 'Building report…' : 'End & build report'}
                </button>
                <button onClick={() => setConfirmEnd(false)} className="btn-ghost text-sm">Keep teaching</button>
              </span>
            ) : (
              <button onClick={askEnd} className="btn-ghost text-sm">End session…</button>
            )}
          </>
        )}
      </TopBar>

      <main className="grid min-h-0 flex-1 gap-5 p-5 lg:grid-cols-[minmax(340px,420px)_1fr]">
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto">
          <div className={`${fade} ${spotlight ? 'opacity-40' : ''}`}>
            <Meter meter={meter} />
          </div>
          <LiveMoments moments={moments} progress={progress} pushed={pushed} onPush={pushFix} readOnly={taMode} spotlight={spotlight} />
          <div className={`flex flex-col gap-5 ${fade} ${spotlight ? 'opacity-25' : ''}`}>
            {!taMode && (
              <button onClick={pulseCheck} className="btn-ghost py-3 text-base">
                {checkSent ? '✓ Check-in sent to phones' : 'Check in: “Still with me?” (asks about the last 10 minutes)'}
              </button>
            )}
            <Questions questions={questions} onAnswered={(qid) => feedRef.current?.send('mark_answered', { questionId: qid })} />
          </div>
        </div>
        <div className={`flex min-h-0 flex-col ${fade} ${spotlight ? 'opacity-25' : ''}`}>
          <Transcript lines={lines} moments={moments} />
        </div>
      </main>
    </div>
  );
}

const fade = 'transition-opacity duration-700';

function TitleSync({ taMode, code, lost }) {
  useTitle(`${taMode ? 'TA view' : 'Live'} · ${code}${lost ? ` · ${lost} lost` : ''}`);
  return null;
}

// The figure on this screen: the one thing a professor glances at mid-sentence.
function Meter({ meter }) {
  const h = heat(meter.score);
  const fill = Math.min(1, Math.max(meter.score, 0.02));

  // A small "+N" floats up when more students get lost (like a live score), so a glance shows the trend.
  const prev = useRef(meter.lostCount);
  const [delta, setDelta] = useState(null);
  useEffect(() => {
    const d = meter.lostCount - prev.current;
    prev.current = meter.lostCount;
    if (d > 0) setDelta({ n: d, key: Date.now() });
  }, [meter.lostCount]);

  return (
    <section className={`card border-2 transition-[border-color] duration-1000 ${h.border}`}>
      <div className="flex items-center justify-between">
        <div className="label">“Wait, what?” right now</div>
        <span className={`text-xs font-semibold ${h.text}`}>{h.label}</span>
      </div>
      <div className="relative mt-3 flex items-baseline gap-3">
        <span className={`display text-8xl leading-none tabular-nums ${h.text}`}>{meter.lostCount}</span>
        <span className="text-xl text-slate-500">of {meter.active} students lost</span>
        {delta && (
          <span key={delta.key} aria-hidden className="delta absolute -top-5 left-1 text-lg font-bold text-red-600 dark:text-[#ff7a6a]">
            +{delta.n}
          </span>
        )}
      </div>
      {/* scaleX instead of width: animates on the GPU, no layout work (Vercel). */}
      <div className="mt-4 h-5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(meter.score * 100)} aria-label="Share of students lost">
        <div className={`h-full w-full origin-left rounded-full ${h.bar} transition-transform duration-[1500ms] ease-out`} style={{ transform: `scaleX(${fill})` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>Clear</span>
        <span className="tabular-nums">{pct(meter.score)}</span>
        <span>Lost</span>
      </div>
    </section>
  );
}

function LiveMoments({ moments, progress, pushed, onPush, readOnly, spotlight }) {
  if (!moments.length) return null;
  return (
    <section className="card">
      <div className="label mb-3">Moments they got lost</div>
      <ul className="space-y-3">
        {[...moments].reverse().map((m) => {
          const p = progress[m.id];
          return (
            <li
              key={m.id}
              className={`rounded-xl border p-3 transition-[opacity,background-color,border-color,box-shadow] duration-700 ${
                spotlight === m.id
                  ? 'border-pulse-500 bg-pulse-500/10 ring-4 ring-pulse-500/20'
                  : `border-slate-200 dark:border-slate-800 ${spotlight ? 'opacity-40' : ''}`
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {fmtTime(m.startSec)} · {WHY_LABELS[m.whyConfusing]?.label || 'Confusing'}
                </span>
                <span className="text-sm text-slate-500">
                  {m.lostCount}/{m.active} lost
                </span>
              </div>
              {m.evidenceQuote && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">“{m.evidenceQuote}”</p>}
              {!readOnly && (
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={() => onPush(m)} disabled={pushed[m.id]} className="btn-primary px-3 py-1.5 text-sm">
                    {pushed[m.id] ? 'Fix sent to phones' : 'Send fix to phones'}
                  </button>
                  {p && (
                    <span className="text-sm text-slate-500">
                      <span className="tabular-nums">{p.answered}</span> answered · <b className="tabular-nums text-emerald-600 dark:text-[#3ddc97]">{pct(p.correctRate)}</b> correct
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
      <div className="label mb-3">Anonymous questions</div>
      {!open.length && (
        <p className="text-sm text-slate-500">Students’ anonymous questions show up here, most upvoted first.</p>
      )}
      <ul className="space-y-2">
        {open.slice(0, 6).map((q) => (
          <li key={q.id} className="flex items-start gap-3">
            <span className="mt-0.5 min-w-[2.5rem] rounded-lg bg-slate-100 px-2 py-1 text-center text-sm font-bold tabular-nums dark:bg-slate-800">
              <span aria-hidden>▲ </span>
              <span className="sr-only">Upvotes: </span>
              {q.upvotes}
            </span>
            <span className="min-w-0 flex-1 break-words text-base">{q.text}</span>
            <button
              onClick={() => onAnswered(q.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-got/10 hover:text-emerald-600"
              aria-label={`Mark answered: ${q.text}`}
              title="Mark answered"
            >
              <span aria-hidden>✓</span>
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
        {!lines.length && (
          <p className="text-base text-slate-500">Start talking. Your words appear here as you teach, and lines where students got lost are marked.</p>
        )}
        {lines.map((l, idx) => {
          // Older lines recede so the current sentence is the figure; hovering brings any line back.
          const age = lines.length - 1 - idx;
          const isFlagged = flagged.has(l.startSec);
          const op = age === 0 ? '' : age === 1 ? 'opacity-80' : age === 2 ? 'opacity-60' : isFlagged ? 'opacity-60' : 'opacity-40';
          return (
          <p
            key={l.startSec}
            className={`flex gap-4 rounded-lg px-2 py-1 transition-opacity duration-700 hover:opacity-100 ${op} ${isFlagged ? 'bg-lost/10 ring-1 ring-lost/40' : ''}`}
          >
            <span className="w-12 shrink-0 pt-1 font-mono text-sm tabular-nums text-slate-400">{fmtTime(l.startSec)}</span>
            <span className={`min-w-0 break-words ${l.final ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{l.text}</span>
            {flagged.has(l.startSec) && <span className="hand ml-auto shrink-0 -rotate-2 text-xl text-red-600 dark:text-pulse-400"><span className="sr-only">Students got lost here: </span>wait, what?!</span>}
          </p>
          );
        })}
      </div>
    </section>
  );
}
