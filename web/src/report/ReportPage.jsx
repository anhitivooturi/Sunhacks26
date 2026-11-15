import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTitle } from '../lib/theme.js';
import { TopBar, Loading, ErrorBox } from '../components/Chrome.jsx';
import { getReport } from '../lib/api.js';
import { createHostFeed } from '../lib/feed.js';
import { confidenceFor, fmtTime, heat, pct } from '../lib/format.js';
import { loadSession } from '../host/session.js';
import Timeline from './Timeline.jsx';
import MomentPanel from './MomentPanel.jsx';
import { TopicTable, DeliveryStats, Unanswered, RecapBox, Confidence } from './Sections.jsx';
import TranscriptReview from './TranscriptReview.jsx';
import { fmtDateTime, getSessionMeta, recordSummary } from '../lib/classes.js';

export default function ReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  // The selected moment lives in the URL (?m=m2) so a link opens the same moment (Vercel: deep-link everything).
  const [params, setParams] = useSearchParams();
  const selected = params.get('m');
  const setSelected = useCallback(
    (mid) => setParams((p) => { const next = new URLSearchParams(p); next.set('m', mid); return next; }, { replace: true }),
    [setParams]
  );
  const [live, setLive] = useState({}); // momentId -> quiz_progress from the socket
  const feedRef = useRef(null);
  const session = loadSession(id);
  const [meta, setMeta] = useState(null); // course / section / lecture title for the header
  useEffect(() => {
    getSessionMeta(id).then(setMeta).catch(() => {});
  }, [id]);
  useTitle(report ? `Report · ${report.moments.length} moment${report.moments.length === 1 ? '' : 's'}` : 'Building report');

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await getReport(id);
      setReport(r);
      recordSummary(id, r); // so the Classes page shows this lecture's real numbers
      // Lead with the worst moment: that's the one thing a professor should look at first.
      const worst = [...(r.moments || [])].sort((a, b) => b.score - a.score)[0];
      if (!new URLSearchParams(window.location.search).get('m') && worst) setSelected(worst.id);
    } catch (e) {
      setError(e.message || 'Could not load the report.');
    }
  }, [id, setSelected]);

  useEffect(() => {
    load();
  }, [load]);

  // Connect to the session socket only when the professor pushes a fix from the report.
  const ensureFeed = () => {
    if (feedRef.current || !session) return feedRef.current;
    const feed = createHostFeed(session.code);
    feed.on('quiz_progress', (p) => setLive((prev) => ({ ...prev, [p.momentId]: p })));
    feedRef.current = feed;
    return feed;
  };
  useEffect(() => () => feedRef.current?.close(), []);

  // Re-fetch once quiz answers stop arriving, so before/after scores come from the server.
  useEffect(() => {
    if (!Object.keys(live).length) return;
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [live, load]);

  if (error)
    return (
      <>
        <TopBar />
        <ErrorBox
          title="Couldn’t load the report"
          hint="The report may still be generating, or the server isn’t reachable. Wait a few seconds and try again."
          message={error}
          onRetry={load}
        />
      </>
    );
  if (!report) return (<><TopBar /><Loading label="Building your report…" /></>);

  const moment = report.moments.find((m) => m.id === selected) || report.moments[0];
  const avgUnderstanding = report.topics.length
    ? report.topics.reduce((a, t) => a + (t.understanding || 0), 0) / report.topics.length
    : null;
  const lowConfidence = report.participants < 6;

  return (
    <div className="min-h-screen pb-16">
      <TopBar>
        <Link to={meta?.course ? `/classes?course=${encodeURIComponent(meta.course)}&section=${encodeURIComponent(meta.section || '')}` : '/classes'} className="btn-ghost text-sm">
          ← All classes
        </Link>
        <button onClick={() => window.print()} className="btn-ghost text-sm">Print report</button>
      </TopBar>
      <main className="mx-auto max-w-7xl space-y-6 px-6 pt-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="label">
              {meta ? [meta.course, meta.section, meta.title, meta.startedAt && fmtDateTime(meta.startedAt)].filter(Boolean).join(' · ') : 'Lecture report'}
            </div>
            <h1 className="wordmark mt-1 text-4xl [text-wrap:balance]">
              {report.moments.length} <span className="hl-mark">“wait, what?”</span> moment{report.moments.length === 1 ? '' : 's'} in this lecture
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Stat label="Length" value={fmtTime(report.durationSec)} />
            <Stat label="Students" value={report.participants} />
            <Stat label="Understanding" value={pct(avgUnderstanding)} />
            <Stat label="Open questions" value={report.unanswered.length} />
          </div>
        </header>

        {lowConfidence && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Only {report.participants} students took part, so treat these numbers as a hint, not a verdict.
          </p>
        )}

        <Timeline report={report} selected={moment?.id} onSelect={setSelected} />

        {report.moments.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Confusion moments">
            {report.moments.map((m) => {
              const h = heat(m.score);
              const on = moment?.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium tabular-nums ${on ? 'border-pulse-500 bg-pulse-500/10' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-transparent'}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${h.bar}`} />
                  {fmtTime(m.startSec)} · {pct(m.score)} lost
                  <Confidence level={confidenceFor(m, report.participants)} compact />
                </button>
              );
            })}
          </div>
        )}

        {moment ? (
          <MomentPanel
            key={moment.id}
            moment={moment}
            participants={report.participants}
            liveProgress={live[moment.id]}
            canPush={!!session}
            onPush={() => ensureFeed()?.send('push_fix', { momentId: moment.id })}
          />
        ) : (
          <div className="card text-center text-slate-500">
            No moment had enough students tap “Lost” to count as confusion. Nice lecture. Check the full breakdown for open questions.
          </div>
        )}

        <RecapBox initial={report.recap} sessionId={report.sessionId} />

        <TranscriptReview sessionId={id} report={report} />

        <Breakdown report={report} />
      </main>
    </div>
  );
}

// Everything that isn't the main moment stays one click away instead of competing for attention.
function Breakdown({ report }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('pulse-breakdown-open') === '1';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem('pulse-breakdown-open', o ? '0' : '1');
      } catch { /* ignore */ }
      return !o;
    });
  };
  const parts = [
    `${report.topics.length} topics`,
    report.deliveryStats ? 'your delivery' : null,
    `${report.unanswered.length} open question${report.unanswered.length === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return (
    <section>
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-5 py-4 text-left hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900"
      >
        <span>
          <span className="block font-semibold">Full breakdown</span>
          <span className="block text-sm text-slate-500">{parts.join(' · ')}</span>
        </span>
        <span className={`text-xl text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {open && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <TopicTable topics={report.topics} participants={report.participants} />
            <DeliveryStats stats={report.deliveryStats} />
          </div>
          <Unanswered list={report.unanswered} />
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-800">
      <div className="label">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
