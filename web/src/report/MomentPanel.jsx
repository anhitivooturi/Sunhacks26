import { useState } from 'react';
import { confidenceFor, fmtTime, heat, pct, WHY_LABELS } from '../lib/format.js';
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
          <span className={`rounded-full px-3 py-1 text-sm font-bold text-white ${h.bar}`}>
            {fmtTime(m.startSec)} – {fmtTime(m.endSec)}
          </span>
          <span className="text-lg font-semibold">
            {m.lostCount} of {m.active} students lost
          </span>
          <Confidence level={confidenceFor(m, participants)} n={m.active} />
        </div>

        <div>
          <div className="label">Why it was confusing</div>
          <div className="mt-1 text-2xl font-bold">{why.label}</div>
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
            <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-base">
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
                      className={`rounded-lg px-2 py-1 ${showAnswers && j === q.answerIndex ? 'bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800'}`}
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
            {pushed ? 'Pushed to phones' : 'Push to students’ phones'}
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
                  next.done ? 'bg-emerald-500' : s.done ? 'bg-gradient-to-r from-emerald-500 to-slate-300 dark:to-slate-700' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-500 ${
                state === 'done'
                  ? 'bg-emerald-500 text-white'
                  : state === 'current'
                    ? 'bg-pulse-500 text-white ring-4 ring-pulse-500/25'
                    : 'border-2 border-slate-300 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className="relative z-10 min-w-0 bg-white pr-2 dark:bg-slate-900">
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

function BeforeAfter({ before, after, answered }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
      <div>
        <div className="label">Before</div>
        <div className="text-3xl font-black text-rose-500">{pct(before)}</div>
        <div className="text-sm text-slate-500">lost</div>
      </div>
      <div className="text-2xl text-slate-400">→</div>
      <div>
        <div className="label">After the fix</div>
        <div className={`text-3xl font-black ${after == null ? 'text-slate-400' : 'text-emerald-500'}`}>{pct(after)}</div>
        <div className="text-sm text-slate-500">{after == null ? 'push the quiz to measure' : `correct · ${answered} answered`}</div>
      </div>
    </div>
  );
}

// Highlights the evidence quote inside the passage (exact substring, per the contract).
function Highlighted({ text = '', quote = '' }) {
  const i = quote ? text.indexOf(quote) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-rose-500/25 px-1 text-inherit dark:bg-rose-500/30">{quote}</mark>
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
