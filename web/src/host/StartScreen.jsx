import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/Chrome.jsx';
import { createSession } from '../lib/api.js';
import { checkMic } from './audio.js';
import { saveSession } from './session.js';
import { useTitle } from '../lib/theme.js';
import Pip from '../student/components/Mascot.jsx';
import { knownCourses, lastClass, recordSession, rememberClass } from '../lib/classes.js';

// Step 1: one big button. Step 2: code + QR huge enough for the back row, then "Go live".
export default function StartScreen() {
  const nav = useNavigate();
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useTitle(session ? `Join code ${session.code}` : 'Start class');
  const [mic, setMic] = useState('unknown'); // unknown | ok | blocked
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('pulse-transcribe-mode') || 'transcribe';
    } catch {
      return 'transcribe';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pulse-transcribe-mode', mode);
    } catch { /* ignore */ }
  }, [mode]);

  // Label the class before starting, so every report and chart knows which class it was.
  // Pre-filled with last time's course and section; only the lecture title usually changes.
  const [meta, setMeta] = useState(() => {
    const l = lastClass();
    return { course: l.course, section: l.section, title: '' };
  });
  const [courses, setCourses] = useState({});
  const [fieldError, setFieldError] = useState('');
  useEffect(() => {
    knownCourses().then(setCourses).catch(() => {});
  }, []);
  const set = (k) => (e) => setMeta((m) => ({ ...m, [k]: e.target.value }));

  const start = async (e, override) => {
    e?.preventDefault();
    const m = override || meta;
    const clean = { course: m.course.trim(), section: m.section.trim(), title: m.title.trim() };
    if (!clean.course) {
      setFieldError('Add the course so this class shows up in your history, for example “CSE 110”.');
      document.getElementById('course')?.focus();
      return;
    }
    setFieldError('');
    setBusy(true);
    setError('');
    try {
      // Don't block on the mic prompt: show the QR right away and report mic status when it resolves.
      checkMic().then((ok) => setMic(ok ? 'ok' : 'blocked'));
      const s = await createSession(clean);
      rememberClass(clean);
      recordSession({ id: s.id, ...clean, startedAt: s.startedAt });
      saveSession(s);
      setSession(s);
    } catch (e) {
      setError(e.message || 'Could not start a session.');
    } finally {
      setBusy(false);
    }
  };

  const goLive = () => nav(`/host/${session.id}`, { state: { session, mode } });

  if (!session) {
    return (
      <div className="min-h-screen">
        <TopBar />
        <main className="relative mx-auto grid max-w-[1400px] items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:px-12">
          <div className="flex flex-col gap-5">
            <span className="eyebrow">
              <span className="live-dot" aria-hidden /> for teachers · <span className="hand text-xl leading-none">live during lecture</span>
            </span>
            <h1 className="hero-title" style={{ fontSize: "clamp(3rem, min(7.5vw, 11dvh), 7rem)" }}>
              <span className="drop block">Hear every</span>
              <span className="hl hero-hl drop" style={{ '--d': '.15s' }}>wait, what?</span>
            </h1>
            <p className="max-w-xl text-xl leading-relaxed text-slate-600 dark:text-slate-300">
              Students tap once when they’re lost. <b className="text-slate-900 dark:text-slate-50">Nobody knows who.</b> You see the{' '}
              <i className="font-bold not-italic text-amber-700 dark:text-hl">exact sentence</i> that lost them, why, and a fix, before the exam.
            </p>

            <form onSubmit={start} className="flex max-w-xl flex-col gap-4" noValidate>
              <span className="label">which class is this?</span>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="course" label="Course" placeholder="CSE 110…" value={meta.course} onChange={set('course')} list="course-list" />
                <Field id="section" label="Section (optional)" placeholder="Section A · MWF 10:30…" value={meta.section} onChange={set('section')} list="section-list" />
              </div>
              <Field id="title" label="Today’s lecture (optional)" placeholder="Recursion…" value={meta.title} onChange={set('title')} />
              <datalist id="course-list">{Object.keys(courses).map((c) => <option key={c} value={c} />)}</datalist>
              <datalist id="section-list">{(courses[meta.course] || []).map((s) => <option key={s} value={s} />)}</datalist>
              {fieldError && <p role="alert" className="text-sm font-medium text-red-600 dark:text-pulse-400">{fieldError}</p>}
              <button type="submit" disabled={busy} className="hero-cta mt-1">
                {busy ? 'Starting class…' : 'Start class →'}
              </button>
              <button
                type="button"
                className="hand w-fit text-left text-2xl text-slate-500 underline decoration-wavy decoration-slate-400/40 underline-offset-[6px] hover:text-amber-700 dark:text-slate-300 dark:hover:text-hl"
                onClick={() => {
                  const demo = { course: 'CSE 110', section: 'Section A · MWF 10:30', title: 'Recursion' };
                  setMeta(demo);
                  start(null, demo);
                }}
              >
                no class yet? try a demo class →
              </button>
            </form>
            {error && (
              <p role="alert" className="text-red-600 dark:text-pulse-400">
                Couldn’t start a session: {error} Check that the server is running, then try again.
              </p>
            )}

            <dl className="section mt-2 grid max-w-xl grid-cols-3 gap-4 pt-5">
              {[['1 click', 'to start class'], ['0 logins', 'for students'], ['after class', 'the fix, ready']].map(([n, l]) => (
                <div key={l}>
                  <dt className="display text-2xl sm:text-3xl">{n}</dt>
                  <dd className="hand text-lg text-slate-500 dark:text-slate-400">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ProjectorDemo />
        </main>
      </div>
    );
  }

  const shortUrl = session.joinUrl.replace(/^https?:\/\//, '');

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[auto_1fr]">
        <div className="-rotate-[1.5deg] rounded-[2rem] border-[3px] border-ink bg-[#fff] p-5 shadow-[0_8px_0_rgba(0,0,0,.45)]">
          <img src={session.qrDataUrl} alt={`QR code to join ${session.code}`} className="h-[340px] w-[340px] sm:h-[420px] sm:w-[420px]" />
        </div>
        <div>
          {session.course && (
            <div className="mb-6 text-lg font-semibold text-slate-600 dark:text-slate-300">
              {[session.course, session.section, session.title].filter(Boolean).join(' · ')}
            </div>
          )}
          <div className="label">Join on your phone</div>
          <div className="mt-2 break-all text-3xl font-bold sm:text-4xl">{shortUrl}</div>
          <div className="mt-8 label">or enter code</div>
          {/* The code sits on the highlighter, the same way students see it on the join screen. */}
          <div translate="no" className="wordmark mt-3 text-[96px] leading-none tracking-[0.12em] sm:text-[140px]">
            <span className="hl-mark">{session.code}</span>
          </div>
          <p className="hand mt-4 text-2xl text-slate-600 dark:text-slate-300">no login · nobody sees who tapped</p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button onClick={goLive} className="hero-cta px-8">Start teaching →</button>
            <MicBadge mic={mic} onRetry={async () => setMic((await checkMic()) ? 'ok' : 'blocked')} />
          </div>

          <div className="mt-6 flex items-center gap-3 text-sm">
            <span className="text-slate-500">Transcription:</span>
            {[
              ['transcribe', 'Amazon Transcribe'],
              ['browser', 'Browser fallback'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`rounded-lg px-3 py-1.5 font-medium ${mode === value ? 'bg-slate-900 text-slate-50 dark:bg-chalk dark:text-ink' : 'border border-slate-300 dark:border-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// The student join page floats a phone; the teacher page floats the projector screen they will see.
function ProjectorDemo() {
  const seq = [1, 2, 4, 7, 9, 8, 5, 3, 2, 1];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % seq.length), 1400);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lost = seq[i];
  const h = lost >= 7 ? '#ff5a47' : lost >= 4 ? '#ff9f1c' : '#3ddc97';
  return (
    <div className="relative mx-auto hidden w-full max-w-[560px] lg:block" aria-hidden>
      <Pip size={84} mood={lost >= 7 ? 'worried' : 'idle'} className="absolute -left-10 -top-12 z-10 drop-shadow-xl" />
      <div className="phone-frame" style={{ borderRadius: '1.6rem', aspectRatio: '16 / 10', height: 'auto', animationDuration: '7s' }}>
        <div className="phone-screen" style={{ borderRadius: '1.1rem' }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #17302a 0%, #0f1a17 62%)' }} />
          <div className="relative grid h-full grid-cols-[1.25fr_1fr] gap-3 p-4 text-chalk">
            <div className="pglass flex flex-col rounded-2xl p-4">
              <span className="hand text-lg leading-none text-hl">lost right now</span>
              <span className="display mt-3 text-7xl leading-none tabular-nums" style={{ color: h, transition: 'color .6s' }}>{lost}</span>
              <span className="text-sm text-chalk/60">of 22 students</span>
              <span className="mt-auto block h-2.5 overflow-hidden rounded-full bg-chalk/10">
                <span className="block h-full w-full origin-left rounded-full" style={{ background: h, transform: `scaleX(${lost / 22})`, transition: 'transform 1s ease-out, background .6s' }} />
              </span>
            </div>
            <div className="flex flex-col gap-2 text-[11px] leading-snug">
              <span className="hand text-base leading-none text-hl">questions</span>
              <span className="pglass rounded-xl px-2 py-1.5">▲ 9 · What exactly is a base case?</span>
              <span className="pglass rounded-xl px-2 py-1.5">▲ 4 · Where does the stack come from?</span>
              <span className="hand mt-1 text-base leading-none text-hl">where they got lost</span>
              <span className="pglass rounded-xl px-2 py-1.5"><b>Undefined term</b> · 2:36</span>
            </div>
          </div>
        </div>
      </div>
      <div className="pin-note" style={{ right: '-1.5rem', top: '-1.6rem', '--d': '.9s' }}>
        <span className="pin-note-body hand" style={{ color: '#ff5a47' }}>the exact sentence</span>
      </div>
      <div className="pin-note" style={{ left: '-2rem', bottom: '-1.4rem', '--d': '1.3s' }}>
        <span className="pin-note-body hand" style={{ color: '#11935a' }}>nobody knows who tapped</span>
      </div>
      <div className="pin-note" style={{ right: '1rem', bottom: '-1.8rem', '--d': '1.7s' }}>
        <span className="pin-note-body hand" style={{ color: '#0b7fb3' }}>fix in one click</span>
      </div>
    </div>
  );
}

function Field({ id, label, ...props }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      <input
        id={id}
        name={id}
        autoComplete="off"
        spellCheck={false}
        className="w-full px-3.5 py-3 text-lg"
        {...props}
      />
    </label>
  );
}

function MicBadge({ mic, onRetry }) {
  if (mic === 'ok') return <span className="text-sm font-medium text-emerald-600 dark:text-got">● Microphone ready</span>;
  if (mic === 'blocked')
    return (
      <button onClick={onRetry} className="text-sm font-medium text-red-600 dark:text-pulse-400 underline">
        Microphone blocked. Allow it and retry.
      </button>
    );
  return null;
}
