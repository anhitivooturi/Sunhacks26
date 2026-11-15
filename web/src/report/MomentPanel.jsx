import { useState } from 'react';
import { confidenceFor, fmtTime, heat, pct, WHY_LABELS } from '../lib/format.js';
import Pip from '../student/components/Mascot.jsx';
import { Confidence } from './Sections.jsx';

export default function MomentPanel({ moment: m, participants, liveProgress, canPush, onPush }) {
  const why = WHY_LABELS[m.whyConfusing] || { label: 'Confusing passage', hint: '' };
  const h = heat(m.score);
  const [pushed, setPushed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(() => isSaved(m.id));
  const [showAnswers, setShowAnswers] = useState(false);

  // "After" comes from the live socket first, then from the server's updated report.
  const answered = liveProgress?.answered ?? m.quizAnswered ?? 0;
  // resolved is 0 (not null) in reports where nobody took the quiz yet, so treat "no answers" as "not measured".
  const after = liveProgress?.correctRate ?? (answered > 0 ? m.resolved : null);

  const copy = async () => {
    const text = `${m.reexplanation}\n\nFor example: ${m.example}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy this:', text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const save = () => {
    toggleSaved(m);
    setSaved(isSaved(m.id));
  };

  const fixSent = pushed || answered > 0;
  const steps = [
    { key: 'detect', title: 'Detect', value: `${m.lostCount}/${m.active} lost`, sub: `at ${fmtTime(m.startSec)}`, done: true },
    { key: 'explain', title: 'Explain', value: why.label, sub: 'from your own words', done: true },
    { key: 'fix', title: 'Fix', value: fixSent ? 'Sent to phones' : 'Ready', sub: fixSent ? 're-explanation + quiz' : 'push it below', done: fixSent },
    {
      key: 'verify',
      title: 'Verify',
      value: after == null ? 'Waiting' : `${pct(after)} correct`,
      sub: after == null ? 'quiz results land here' : `was ${pct(m.score)} lost`,
      done: after != null,
    },
  ];

  return (
    <div className="space-y-4">
      <LoopBar steps={steps} />
    <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* DETECT + EXPLAIN */}
      <div className="card space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-bold text-ink ${h.bar}`}>
            {fmtTime(m.startSec)} – {fmtTime(m.endSec)}
          </span>
          <span className="text-lg font-semibold">
            {m.lostCount} of {m.active} students lost
          </span>
          <Confidence level={confidenceFor(m, participants)} n={m.active} />
        </div>

        <div>
          <div className="label">Why it was confusing</div>
          <div className="display mt-1 text-3xl">{why.label}</div>
          <p className="mt-1 text-slate-600 dark:text-slate-300">{m.summary || why.hint}</p>
        </div>

        <div>
          <div className="label mb-2">What you said</div>
          <blockquote className="rounded-xl border-l-4 border-slate-300 bg-slate-50 p-4 text-lg leading-relaxed dark:border-slate-700 dark:bg-slate-950">
            <Highlighted text={m.passage} quote={m.evidenceQuote} />
          </blockquote>
        </div>

        <BeforeAfter before={m.score} after={after} answered={answered} />
      </div>

      {/* FIX */}
      <div className="card space-y-5">
        <div>
          <div className="label">Ready-made fix</div>
          <p className="mt-2 text-lg leading-relaxed">{m.reexplanation}</p>
          {m.example && (
            <p className="mt-3 rounded-xl bg-got/10 p-3 text-base">
              <b>Example:</b> {m.example}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="label">3-question check quiz</div>
            <button onClick={() => setShowAnswers((s) => !s)} className="text-sm text-slate-500 underline">
              {showAnswers ? 'Hide answers' : 'Show answers'}
            </button>
          </div>
          <ol className="space-y-3">
            {(m.quiz || []).map((q, i) => (
              <li key={i} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="font-semibold">
                  {i + 1}. {q.q}
                </div>
                <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {q.options.map((o, j) => (
                    <li
                      key={j}
                      className={`rounded-lg px-2 py-1 ${showAnswers && j === q.answerIndex ? 'bg-got/15 font-semibold text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800'}`}
                    >
                      {String.fromCharCode(65 + j)}. {o}
                    </li>
                  ))}
                </ul>
                {showAnswers && q.explanation && <p className="mt-2 text-sm text-slate-500">{q.explanation}</p>}
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button onClick={copy} className="btn-ghost">{copied ? '✓ Copied' : 'Copy to read aloud'}</button>
          <button
            onClick={() => {
              onPush();
              setPushed(true);
            }}
            disabled={!canPush || pushed}
            className="btn-primary"
            title={canPush ? '' : 'Open this report from the session laptop to push to phones'}
          >
            {pushed ? 'Sent to phones' : 'Send fix to phones'}
          </button>
          <button onClick={save} className="btn-ghost">{saved ? '★ Saved for next lecture' : '☆ Save for next lecture'}</button>
        </div>
      </div>
    </section>
    </div>
  );
}

// The pitch as a connected rail: each step lights up as the loop completes.
function LoopBar({ steps }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="card grid grid-cols-1 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Detect, explain, fix, verify">
      {steps.map((s, i) => {
        const state = s.done ? 'done' : i === current ? 'current' : 'todo';
        const next = steps[i + 1];
        return (
          <li key={s.key} className="relative flex items-start gap-3 pr-4">
            {/* connector to the next step */}
            {next && (
              <span
                aria-hidden
                className={`absolute left-10 right-0 top-4 hidden h-0.5 lg:block ${
                  next.done ? 'bg-got' : s.done ? 'bg-gradient-to-r from-got to-slate-300 dark:to-slate-700' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-500 ${
                state === 'done'
                  ? 'bg-got text-ink'
                  : state === 'current'
                    ? 'bg-hl text-ink ring-4 ring-hl/30'
                    : 'border-2 border-slate-300 bg-[#fff] text-slate-400 dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className="relative z-10 min-w-0 bg-[#fff] pr-2 dark:bg-slate-900">
              <span className="label block">{s.title}</span>
              <span className={`block truncate font-bold ${state === 'todo' ? 'text-slate-400' : ''}`}>{s.value}</span>
              <span className="block truncate text-xs text-slate-500">{s.sub}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// Two score rings (like Lighthouse): how many were lost, then how many got the check quiz right.
// When the fix clearly worked, Pip cheers once, quietly. No confetti in a product screen.
function BeforeAfter({ before, after, answered }) {
  const worked = after != null && after >= 0.7;
  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/60">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-3">
          <Ring value={before} color="#ff5a47" />
          <div>
            <div className="label">Before</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">lost at this moment</div>
          </div>
        </div>
        <div className="text-2xl text-slate-400" aria-hidden>→</div>
        <div className="flex items-center gap-3">
          <Ring value={after} color="#3ddc97" />
          <div>
            <div className="label">After the fix</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {after == null ? 'send the quiz to measure' : <><span className="tabular-nums">{answered}</span> answered the quiz</>}
            </div>
          </div>
        </div>
      </div>
      {worked && (
        <div className="pop-in mt-3 flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800" role="status">
          <Pip size={28} mood="cheer" beat={false} />
          <span className="hand text-2xl text-emerald-700 dark:text-got">ohh, they get it now!</span>
          <span className="text-sm text-slate-500">The fix worked for most of the class.</span>
        </div>
      )}
    </div>
  );
}

function Ring({ value, color, size = 64 }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.min(1, Math.max(0, value));
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0" role="img" aria-label={value == null ? 'not measured yet' : pct(value)}>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-slate-200 dark:stroke-slate-800" />
      <circle
        cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dashoffset 900ms ease-out' }}
      />
      <text x="32" y="37" textAnchor="middle" className="fill-current" style={{ font: '800 15px "Bricolage Grotesque", Inter, sans-serif' }}>
        {value == null ? '—' : pct(value)}
      </text>
    </svg>
  );
}

// Highlights the evidence quote inside the passage (exact substring, per the contract).
function Highlighted({ text = '', quote = '' }) {
  const i = quote ? text.indexOf(quote) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="evidence">{quote}</mark>
      {text.slice(i + quote.length)}
    </>
  );
}

const SAVE_KEY = 'pulse-saved-fixes';
const readSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
  } catch {
    return [];
  }
};
const isSaved = (id) => readSaved().some((f) => f.id === id);
const toggleSaved = (m) => {
  const list = readSaved();
  const next = list.some((f) => f.id === m.id) ? list.filter((f) => f.id !== m.id) : [...list, { id: m.id, reexplanation: m.reexplanation, example: m.example, quiz: m.quiz }];
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
};
