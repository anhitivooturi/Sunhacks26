import { useEffect, useMemo, useState } from 'react';
import { getActivity, getTranscript } from '../lib/api.js';
import { fmtTime, WHY_LABELS } from '../lib/format.js';

// After class: the transcript, with every Lost tap and question placed on the line students were reacting to.
// Neighbouring lines where taps and questions pile up become one "cluster", labelled with the AI's topic for
// that part of the lecture and, when a confusion moment overlaps it, the AI's reason (undefined term, etc.).
const REACTION_DELAY = 8; // students tap a few seconds after the line that lost them (contract uses T-20..T-4)
const MIN_CLUSTER = 3; // taps + questions needed for a line to count as a hot spot

export default function TranscriptReview({ sessionId, report }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(null);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    if (!open || lines) return;
    Promise.all([getTranscript(sessionId), getActivity(sessionId)]).then(([t, a]) => {
      setLines(Array.isArray(t) ? t : []);
      setActivity(Array.isArray(a) ? a : []);
    });
  }, [open, lines, sessionId]);

  const { perLine, clusters } = useMemo(() => analyze(lines || [], activity, report), [lines, activity, report]);
  const maxLost = Math.max(1, ...perLine.map((l) => l.lost));

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-5 py-4 text-left hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900"
      >
        <span>
          <span className="block font-semibold">Review the transcript</span>
          <span className="block text-sm text-slate-500">Where questions and “Lost” taps piled up, line by line</span>
        </span>
        <span className={`text-xl text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>⌄</span>
      </button>

      {open && !lines && <p className="mt-4 text-sm text-slate-500" role="status">Loading the transcript…</p>}
      {open && lines && !lines.length && (
        <p className="mt-4 text-sm text-slate-500">No transcript was saved for this class. Check that transcription was on before class started.</p>
      )}

      {open && lines?.length > 0 && (
        <div className="mt-6 space-y-8">
          {clusters.length > 0 && (
            <div>
              <div className="label mb-3">Where students piled up</div>
              <ol className="grid gap-4 lg:grid-cols-2">
                {clusters.slice(0, 4).map((c) => (
                  <li key={c.start} className="card space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="display text-xl">{c.topic || 'This part of the lecture'}</span>
                      <span className="font-mono text-sm tabular-nums text-slate-500">
                        {fmtTime(c.start)}–{fmtTime(c.end)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      <b className="tabular-nums">{c.lost}</b> “Lost” taps and <b className="tabular-nums">{c.questions.length}</b> question
                      {c.questions.length === 1 ? '' : 's'} across {c.lines.length} line{c.lines.length === 1 ? '' : 's'}.
                      {c.why && <> Likely cause: <b>{WHY_LABELS[c.why]?.label.toLowerCase()}</b>.</>}
                    </p>
                    <blockquote className="rounded-xl border-l-4 border-hl bg-slate-50 p-3 text-sm leading-relaxed dark:bg-slate-950/60">
                      {c.lines.map((l) => l.text).join(' ')}
                    </blockquote>
                    {c.questions.length > 0 && (
                      <ul className="space-y-1 text-sm">
                        {c.questions.slice(0, 4).map((q, i) => (
                          <li key={i} className="flex gap-2 text-slate-700 dark:text-slate-200">
                            <span aria-hidden className="text-slate-400">?</span>
                            {q}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <div className="label mb-3">Full transcript</div>
            <ol className="space-y-1">
              {perLine.map((l) => (
                <li key={l.startSec} className={`grid grid-cols-[3rem_1fr_6rem] items-start gap-3 rounded-lg px-2 py-1.5 ${l.hot ? 'bg-hl/15' : ''}`}>
                  <span className="pt-0.5 font-mono text-xs tabular-nums text-slate-400">{fmtTime(l.startSec)}</span>
                  <span className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-100">{l.text}</span>
                  <span className="flex items-center gap-2 pt-1" aria-label={`${l.lost} lost taps, ${l.questions.length} questions`}>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden>
                      <span className="block h-full origin-left rounded-full bg-[#4d5751] dark:bg-[#8a918a]" style={{ transform: `scaleX(${l.lost / maxLost})` }} />
                    </span>
                    <span className="w-6 text-right text-xs tabular-nums text-slate-500">{l.lost || ''}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-slate-500">Bar = “Lost” taps that landed on each line. Highlighted lines are where taps and questions piled up.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function analyze(lines, activity, report) {
  const perLine = lines.map((l, i) => ({
    ...l,
    endSec: l.endSec ?? lines[i + 1]?.startSec ?? l.startSec + 15,
    lost: 0,
    questions: [],
  }));
  const lineAt = (sec) => perLine.find((l) => sec >= l.startSec && sec < l.endSec) || perLine[perLine.length - 1];
  activity.forEach((a) => {
    const line = lineAt(Math.max(0, a.atSec - REACTION_DELAY));
    if (!line) return;
    if (a.kind === 'lost') line.lost += 1;
    if (a.kind === 'question' && a.text) line.questions.push(a.text);
  });
  perLine.forEach((l) => (l.hot = l.lost + l.questions.length * 2 >= MIN_CLUSTER));

  // Merge neighbouring hot lines into clusters, biggest first.
  const clusters = [];
  let cur = null;
  perLine.forEach((l) => {
    if (l.hot) {
      if (!cur) clusters.push((cur = { lines: [] }));
      cur.lines.push(l);
    } else cur = null;
  });
  clusters.forEach((c) => {
    c.start = c.lines[0].startSec;
    c.end = c.lines[c.lines.length - 1].endSec;
    c.lost = c.lines.reduce((a, l) => a + l.lost, 0);
    c.questions = c.lines.flatMap((l) => l.questions);
    const mid = (c.start + c.end) / 2;
    c.topic = report?.topics?.find((t) => mid >= t.start && mid < t.end)?.title;
    c.why = report?.moments?.find((m) => m.startSec < c.end && m.endSec > c.start)?.whyConfusing;
    c.weight = c.lost + c.questions.length * 2;
  });
  clusters.sort((a, b) => b.weight - a.weight);
  return { perLine, clusters };
}
