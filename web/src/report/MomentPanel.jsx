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
  const after = liveProgress?.correctRate ?? m.resolved;
  const answered = liveProgress?.answered ?? m.quizAnswered ?? 0;

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

  return (
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
