import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { TopBar, StatusDot } from '../components/Chrome.jsx';
import { createHostFeed } from '../lib/feed.js';
import { endSession } from '../lib/api.js';
import { fmtTime, heat, pct, WHY_LABELS } from '../lib/format.js';
import { loadSession } from './session.js';
import { startAudio } from './audio.js';
import { useTitle } from '../lib/theme.js';

// The professor is teaching while this is on screen. It shows only the basics: how many students are lost
// right now, their questions, and where they got lost. Everything else (transcript, analysis) waits for
// after class. Calm colors, big type, nothing flashing.
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
  const [paused, setPaused] = useState(false);
  const [showTranscript, setShowTranscript] = useState(() => {
    try {
      return localStorage.getItem('pulse-show-transcript') === '1';
    } catch {
      return false;
    }
  });
  const feedRef = useRef(null);
  const stopAudioRef = useRef(() => {});

  useEffect(() => {
    try {
      localStorage.setItem('pulse-show-transcript', showTranscript ? '1' : '0');
    } catch { /* ignore */ }
  }, [showTranscript]);

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
      feed.on('moment', ({ moment }) => setMoments((prev) => [...prev.filter((m) => m.id !== moment.id), moment])),
      feed.on('quiz_progress', (p) => setProgress((prev) => ({ ...prev, [p.momentId]: p }))),
    ];
    if (!taMode) startAudio({ sessionId: session.id, mode }).then((stop) => (stopAudioRef.current = stop));
    return () => {
      offs.forEach((off) => off());
      feed.close();
      stopAudioRef.current();
    };
  }, [session?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Class timer that doesn't count paused time.
  const elapsed = useElapsed(paused);

  // Pause stops the microphone and tells the server to stop counting taps; Resume picks up where it left off.
  const togglePause = async () => {
    if (paused) {
      feedRef.current?.send('resume', {});
      if (!taMode) stopAudioRef.current = await startAudio({ sessionId: session.id, mode });
      setPaused(false);
    } else {
      feedRef.current?.send('pause', {});
      stopAudioRef.current();
      stopAudioRef.current = () => {};
      setPaused(true);
    }
  };

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
        This session isn’t on this device anymore. <Link to="/host" className="text-pulse-500 underline">Start a new class</Link>
      </div>
    );
  }

  const newest = moments[moments.length - 1];
  const classLabel = [session.course, session.section, session.title].filter(Boolean).join(' · ');

  return (
    <div className="flex h-screen flex-col">
      <TitleSync taMode={taMode} code={session.code} lost={meter.lostCount} paused={paused} />
      {/* Screen readers hear new confusion moments without the screen changing focus. */}
      <div aria-live="polite" className="sr-only">
        {newest ? `Students got lost at ${fmtTime(newest.startSec)}: ${WHY_LABELS[newest.whyConfusing]?.label || 'confusing passage'}.` : ''}
      </div>

      <TopBar nav={false}>
        <span className="flex items-center gap-2 text-sm text-slate-500">
          <span>Join</span>
          <span translate="no" className="display text-xl tracking-widest text-slate-900 dark:text-slate-50">{session.code}</span>
        </span>
        <span className="hidden font-mono text-sm tabular-nums text-slate-500 sm:inline" aria-label="Class time">
          {paused ? 'Paused' : fmtTime(elapsed)}
        </span>
        {status !== 'open' && <StatusDot status={status} />}
        <button onClick={() => setShowTranscript((v) => !v)} aria-pressed={showTranscript} className="btn-ghost text-sm">
          {showTranscript ? 'Hide transcript' : 'Transcript'}
        </button>
        {!taMode && (
          <>
            <button onClick={togglePause} className="btn-ghost text-sm" aria-pressed={paused}>
              {paused ? '▶ Resume' : '❚❚ Pause'}
            </button>
            {confirmEnd ? (
              <span className="pop-in flex items-center gap-2">
                <button onClick={end} disabled={ending} className="btn-primary text-sm">
                  {ending ? 'Building report…' : 'End & build report'}
                </button>
                <button onClick={() => setConfirmEnd(false)} className="btn-ghost text-sm">Keep teaching</button>
              </span>
            ) : (
              <button onClick={askEnd} className="btn-ghost text-sm">End class…</button>
            )}
          </>
        )}
      </TopBar>

      <div className="flex min-h-0 flex-1">
        <main className="mx-auto grid w-full max-w-6xl content-start gap-6 overflow-y-auto p-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            {classLabel && <div className="text-sm font-medium text-slate-500">{classLabel}</div>}
            <Meter meter={meter} paused={paused} />
            {!taMode && !paused && (
              <button onClick={pulseCheck} className="btn-ghost w-full py-3 text-base">
                {checkSent ? '✓ Check-in sent to phones' : 'Ask “Still with me?” on every phone'}
              </button>
            )}
          </div>
          <div className="space-y-6">
            <Questions questions={questions} onAnswered={(qid) => feedRef.current?.send('mark_answered', { questionId: qid })} />
            <LiveMoments moments={moments} progress={progress} pushed={pushed} onPush={pushFix} readOnly={taMode} />
          </div>
        </main>

        {showTranscript && (
          <aside className="hidden w-[420px] shrink-0 border-l border-slate-200 bg-white/60 lg:flex lg:flex-col dark:border-slate-800 dark:bg-slate-950/40" aria-label="Live transcript">
            <Transcript lines={lines} moments={moments} onClose={() => setShowTranscript(false)} />
          </aside>
        )}
      </div>
    </div>
  );
}

function useElapsed(paused) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [paused]);
  return sec;
}

function TitleSync({ taMode, code, lost, paused }) {
  useTitle(`${paused ? 'Paused' : taMode ? 'TA view' : 'Live'} · ${code}${lost && !paused ? ` · ${lost} lost` : ''}`);
  return null;
}

// The figure on this screen: one number a professor can read from across the room.
function Meter({ meter, paused }) {
  const h = heat(meter.score);
  const fill = Math.min(1, Math.max(meter.score, 0.02));
  if (paused) {
    return (
      <section className="card flex min-h-[280px] flex-col items-center justify-center text-center">
        <div className="display text-5xl text-slate-400">Paused</div>
        <p className="mt-3 max-w-sm text-slate-500">Students can’t tap and nothing is recorded. Press Resume when you’re back.</p>
      </section>
    );
  }
  return (
    <section className={`card min-h-[280px] border-2 transition-[border-color] duration-1000 ${h.border}`}>
      <div className="flex items-center justify-between">
        <div className="label">Lost right now</div>
        <span className={`text-sm font-semibold ${h.text}`}>{h.label}</span>
      </div>
      <div className="mt-6 flex items-baseline gap-3">
        <span className={`display text-[120px] leading-none tabular-nums ${h.text}`}>{meter.lostCount}</span>
        <span className="text-2xl text-slate-500">of {meter.active} students</span>
      </div>
      <div className="mt-8 h-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(meter.score * 100)} aria-label="Share of students lost">
        <div className={`h-full w-full origin-left rounded-full ${h.bar} transition-transform duration-[1500ms] ease-out`} style={{ transform: `scaleX(${fill})` }} />
      </div>
    </section>
  );
}

function LiveMoments({ moments, progress, pushed, onPush, readOnly }) {
  const recent = [...moments].reverse().slice(0, 3);
  return (
    <section className="section">
      <div className="label mb-3">Where they got lost</div>
      {!recent.length && <p className="text-sm text-slate-500">Nothing yet. When several students tap Lost at once, it shows up here.</p>}
      <ul className="space-y-3">
        {recent.map((m) => {
          const p = progress[m.id];
          return (
            <li key={m.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{WHY_LABELS[m.whyConfusing]?.label || 'Confusing part'}</span>
                <span className="text-sm tabular-nums text-slate-500">{fmtTime(m.startSec)} · {m.lostCount} lost</span>
              </div>
              {!readOnly && (
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={() => onPush(m)} disabled={pushed[m.id]} className="btn-ghost px-3 py-1.5 text-sm">
                    {pushed[m.id] ? 'Fix sent to phones' : 'Send fix to phones'}
                  </button>
                  {p && (
                    <span className="text-sm text-slate-500">
                      <b className="tabular-nums text-emerald-600 dark:text-got">{pct(p.correctRate)}</b> got it
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {moments.length > 3 && <p className="mt-2 text-sm text-slate-500">{moments.length - 3} more in the report after class.</p>}
    </section>
  );
}

function Questions({ questions, onAnswered }) {
  const open = questions.filter((q) => !q.answered);
  return (
    <section>
      <div className="label mb-3">Questions</div>
      {!open.length && <p className="text-sm text-slate-500">Students’ anonymous questions show up here, most upvoted first.</p>}
      <ul className="space-y-2">
        {open.slice(0, 3).map((q) => (
          <li key={q.id} className="flex items-start gap-3">
            <span className="mt-0.5 min-w-[2.5rem] rounded-lg bg-slate-100 px-2 py-1 text-center text-sm font-bold tabular-nums dark:bg-slate-800">
              <span aria-hidden>▲ </span>
              <span className="sr-only">Upvotes: </span>
              {q.upvotes}
            </span>
            <span className="min-w-0 flex-1 break-words text-lg">{q.text}</span>
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
      {open.length > 3 && <p className="mt-2 text-sm text-slate-500">+{open.length - 3} more questions</p>}
    </section>
  );
}

function Transcript({ lines, moments, onClose }) {
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
    <>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="label">Live transcript</div>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Hide transcript">
          <span aria-hidden>✕</span>
        </button>
      </div>
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 text-base leading-relaxed"
      >
        {!lines.length && <p className="text-sm text-slate-500">Your words appear here as you teach.</p>}
        {lines.map((l) => (
          <p key={l.startSec} className={`flex gap-3 rounded-lg px-2 py-1 ${flagged.has(l.startSec) ? 'bg-lost/10' : ''}`}>
            <span className="w-10 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-slate-400">{fmtTime(l.startSec)}</span>
            <span className={`min-w-0 break-words ${l.final ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
              {flagged.has(l.startSec) && <span className="sr-only">Students got lost here: </span>}
              {l.text}
            </span>
          </p>
        ))}
      </div>
    </>
  );
}
