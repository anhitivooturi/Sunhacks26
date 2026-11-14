import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/Chrome.jsx';
import { createSession } from '../lib/api.js';
import { checkMic } from './audio.js';
import { saveSession } from './session.js';

// Step 1: one big button. Step 2: code + QR huge enough for the back row, then "Go live".
export default function StartScreen() {
  const nav = useNavigate();
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
        <main className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-24 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">See the moment you lost the class.</h1>
          <p className="mt-5 max-w-xl text-lg text-slate-500 dark:text-slate-400">
            Teach as normal. Students tap when they get lost, and Pulse tells you where, why and how to fix it.
          </p>
          <button onClick={start} disabled={busy} className="btn-primary mt-12 px-12 py-6 text-2xl shadow-lg shadow-pulse-500/30">
            {busy ? 'Starting…' : 'Start session'}
          </button>
          {error && <p className="mt-6 text-rose-500">{error}</p>}
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
          <div className="mt-1 font-mono text-[96px] font-black leading-none tracking-[0.15em] text-pulse-500 sm:text-[140px]">{session.code}</div>
          <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">No login. You stay anonymous.</p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button onClick={goLive} className="btn-primary px-8 py-4 text-xl">Go live →</button>
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
                className={`rounded-lg px-3 py-1.5 font-medium ${mode === value ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-300 dark:border-slate-700'}`}
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
  if (mic === 'ok') return <span className="text-sm font-medium text-emerald-500">● Microphone ready</span>;
  if (mic === 'blocked')
    return (
      <button onClick={onRetry} className="text-sm font-medium text-rose-500 underline">
        Microphone blocked. Allow it and retry.
      </button>
    );
  return null;
}
