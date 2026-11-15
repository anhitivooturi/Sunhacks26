import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/Chrome.jsx';
import { createSession } from '../lib/api.js';
import { checkMic } from './audio.js';
import { saveSession } from './session.js';
import { useTitle } from '../lib/theme.js';
import { knownCourses, lastClass, listSessions, recordSession, rememberClass } from '../lib/classes.js';

// The four student tap colors (Lost, Slow down, Speed up, Got it), used as small accents.
const TAP_COLORS = ['#ff5a47', '#ff9f1c', '#4cc2ff', '#3ddc97'];

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
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    // Last few distinct course + section pairs, newest first: one tap fills the form.
    listSessions()
      .then((list) => {
        const seen = new Set();
        const out = [];
        [...list].reverse().forEach((x) => {
          const k = x.course + '|' + (x.section || '');
          if (!seen.has(k) && out.length < 3) {
            seen.add(k);
            out.push({ course: x.course, section: x.section || '' });
          }
        });
        setRecent(out);
      })
      .catch(() => {});
  }, []);
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
        <main className="mx-auto flex max-w-xl flex-col px-6 pb-20 pt-16 sm:pt-24">
          <h1 className="hero-title" style={{ fontSize: 'clamp(2.6rem, 6vw, 4rem)' }}>
            Which class are you <span className="hl hero-hl">teaching?</span>
          </h1>

          {recent.length > 0 && (
            <div className="mt-8">
              <span className="label">recent</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {recent.map((r, i) => (
                  <button
                    key={r.course + r.section}
                    type="button"
                    onClick={() => setMeta({ course: r.course, section: r.section, title: '' })}
                    className="btn-ghost py-1.5 text-sm"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: TAP_COLORS[i % TAP_COLORS.length] }} aria-hidden />
                    {[r.course, r.section].filter(Boolean).join(' · ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={start} className="mt-8 flex flex-col gap-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="course" label="Course" placeholder="CSE 110…" value={meta.course} onChange={set('course')} list="course-list" />
              <Field id="section" label="Section (optional)" placeholder="Section A…" value={meta.section} onChange={set('section')} list="section-list" />
            </div>
            <Field id="title" label="Today’s lecture (optional)" placeholder="Recursion…" value={meta.title} onChange={set('title')} />
            <datalist id="course-list">{Object.keys(courses).map((c) => <option key={c} value={c} />)}</datalist>
            <datalist id="section-list">{(courses[meta.course] || []).map((s) => <option key={s} value={s} />)}</datalist>
            {fieldError && <p role="alert" className="text-sm font-medium text-red-600 dark:text-pulse-400">{fieldError}</p>}
            <button type="submit" disabled={busy} className="hero-cta mt-2">
              {busy ? 'Starting class…' : 'Start class'}
            </button>
          </form>

          <button
            type="button"
            className="mt-6 w-fit text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
            onClick={() => {
              const demo = { course: 'CSE 110', section: 'Section A · MWF 10:30', title: 'Recursion' };
              setMeta(demo);
              start(null, demo);
            }}
          >
            Try a demo class
          </button>
          {error && (
            <p role="alert" className="mt-4 text-red-600 dark:text-pulse-400">
              Couldn’t start a session: {error} Check that the server is running, then try again.
            </p>
          )}
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

function Field({ id, label, ...props }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
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
