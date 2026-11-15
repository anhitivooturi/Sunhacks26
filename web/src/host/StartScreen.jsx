import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/Chrome.jsx';
import { createSession } from '../lib/api.js';
import { checkMic } from './audio.js';
import { saveSession } from './session.js';
import { useTitle } from '../lib/theme.js';
import Pip from '../student/components/Mascot.jsx';

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

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      // Don't block on the mic prompt: show the QR right away and report mic status when it resolves.
      checkMic().then((ok) => setMic(ok ? 'ok' : 'blocked'));
      const s = await createSession();
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
        <main className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 text-center">
          <Pip size={96} mood="worried" />
          <h1 className="wordmark mt-6 text-5xl leading-[1.05] [text-wrap:balance] sm:text-7xl">
            Catch every <span className="hl-mark">“wait, what?”</span> in your lecture.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-600 [text-wrap:balance] dark:text-slate-300">
            Teach as normal. When students get lost they tap once, anonymously. You see the exact sentence that lost them,
            why, and a fix you can use before the exam.
          </p>
          <button onClick={start} disabled={busy} className="btn-primary mt-12 px-12 py-5 text-2xl">
            {busy ? 'Starting class…' : 'Start class'}
          </button>
          <p className="hand mt-4 text-xl text-slate-500 dark:text-slate-400">no setup · students join with a QR code</p>
          {error && (
            <p role="alert" className="mt-6 text-red-600">
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
        <div className="rounded-3xl bg-white p-5 shadow-xl">
          <img src={session.qrDataUrl} alt={`QR code to join ${session.code}`} className="h-[340px] w-[340px] sm:h-[420px] sm:w-[420px]" />
        </div>
        <div>
          <div className="label">Join on your phone</div>
          <div className="mt-2 break-all text-3xl font-bold sm:text-4xl">{shortUrl}</div>
          <div className="mt-8 label">or enter code</div>
          {/* The code sits on the highlighter, the same way students see it on the join screen. */}
          <div translate="no" className="wordmark mt-3 text-[96px] leading-none tracking-[0.12em] sm:text-[140px]">
            <span className="hl-mark">{session.code}</span>
          </div>
          <p className="hand mt-4 text-2xl text-slate-600 dark:text-slate-300">no login · nobody sees who tapped</p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button onClick={goLive} className="btn-primary px-8 py-4 text-xl">Start teaching →</button>
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
