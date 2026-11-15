import { useState } from 'react';
import { fmtTime, heat, pct } from '../lib/format.js';

export function Confidence({ level = 'low', n, compact = false }) {
  const cls = {
    high: 'bg-got/15 text-emerald-700 dark:text-emerald-300',
    medium: 'bg-amber-400/20 text-amber-700 dark:text-amber-300',
    low: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  }[level];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`} title="Based on how many distinct students took part">
      {compact ? level : `${level} confidence${n != null ? ` · ${n} students` : ''}`}
    </span>
  );
}

export function TopicTable({ topics, participants }) {
  return (
    <section className="section">
      <div className="label mb-3">Topics</div>
      <table className="w-full text-left">
        <thead className="text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="pb-2 font-semibold">Topic</th>
            <th className="pb-2 font-semibold">Confusion</th>
            <th className="pb-2 font-semibold">Questions</th>
            <th className="pb-2 font-semibold">Understood</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((t) => {
            const h = heat(t.confusion);
            return (
              <tr key={t.start} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2.5">
                  <div className="font-semibold">{t.title}</div>
                  <div className="font-mono text-xs text-slate-500">
                    {fmtTime(t.start)} – {fmtTime(t.end)}
                  </div>
                </td>
                <td className="py-2.5">
                  <span className={`font-bold ${h.text}`}>{pct(t.confusion)}</span>
                </td>
                <td className="py-2.5 tabular-nums">{t.questions}</td>
                <td className="py-2.5">{pct(t.understanding)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">Based on {participants} participating students.</p>
    </section>
  );
}

export function DeliveryStats({ stats }) {
  return (
    <section className="section">
      <div className="label mb-3">Your delivery</div>
      {!stats ? (
        <p className="text-sm text-slate-500">Delivery stats will appear once the transcript is analyzed.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Speaking pace"
              value={`${stats.wordsPerMinute} wpm`}
              note={stats.wordsPerMinute > 160 ? 'On the fast side for new material' : 'Comfortable pace'}
              warn={stats.wordsPerMinute > 160}
            />
            <Metric
              label="Longest stretch without an example"
              value={fmtTime(stats.longestStretchWithoutExampleSec)}
              note={stats.longestStretchWithoutExampleSec > 180 ? 'Try an example every 2–3 minutes' : 'Good rhythm'}
              warn={stats.longestStretchWithoutExampleSec > 180}
            />
          </div>
          {!!stats.jargonBeforeDefinition?.length && (
            <div>
              <div className="text-sm font-semibold">Terms used before they were defined</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {stats.jargonBeforeDefinition.map((t) => (
                  <span key={t} className="rounded-lg bg-amber-400/20 px-2 py-1 font-mono text-sm">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, note, warn }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className={`text-xs ${warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>{note}</div>
    </div>
  );
}

export function Unanswered({ list }) {
  return (
    <section className="section">
      <div className="label mb-3">Unanswered questions</div>
      {!list.length ? (
        <p className="text-sm text-slate-500">Every question was answered.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((q) => (
            <li key={q.id} className="flex items-start gap-3">
              <span className="min-w-[2.5rem] rounded-lg bg-slate-100 px-2 py-1 text-center text-sm font-bold dark:bg-slate-800">▲ {q.upvotes}</span>
              <span>{q.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecapBox({ initial, sessionId }) {
  const key = `pulse-recap-${sessionId}`;
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  const [copied, setCopied] = useState(false);
  const update = (v) => {
    setText(v);
    try {
      localStorage.setItem(key, v);
    } catch { /* ignore */ }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy this:', text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <section className="card flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="label">Recap for next class</div>
        <span className="text-xs text-slate-500">{text.split(/\s+/).filter(Boolean).length} words · ~{Math.ceil(text.split(/\s+/).length / 2.5)}s to read</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => update(e.target.value)}
        rows={7}
        className="w-full flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-base leading-relaxed outline-none focus:ring-2 focus:ring-pulse-500 dark:border-slate-800 dark:bg-slate-950"
      />
      <div className="mt-3 flex gap-3">
        <button onClick={copy} className="btn-primary">{copied ? '✓ Copied' : 'Copy recap'}</button>
        {text !== initial && (
          <button onClick={() => update(initial)} className="btn-ghost">Reset</button>
        )}
      </div>
    </section>
  );
}
