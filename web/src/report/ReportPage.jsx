import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TopBar, Loading, ErrorBox } from '../components/Chrome.jsx';
import { getReport } from '../lib/api.js';
import { createHostFeed } from '../lib/feed.js';
import { confidenceFor, fmtTime, heat, pct } from '../lib/format.js';
import { loadSession } from '../host/session.js';
import Timeline from './Timeline.jsx';
import MomentPanel from './MomentPanel.jsx';
import { TopicTable, DeliveryStats, Unanswered, RecapBox, Confidence } from './Sections.jsx';

export default function ReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [live, setLive] = useState({}); // momentId -> quiz_progress from the socket
  const feedRef = useRef(null);
  const session = loadSession(id);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await getReport(id);
      setReport(r);
      // Lead with the worst moment: that's the one thing a professor should look at first.
      const worst = [...(r.moments || [])].sort((a, b) => b.score - a.score)[0];
      setSelected((s) => s || worst?.id || null);
    } catch (e) {
      setError(e.message || 'Could not load the report.');
    }
  }, [id]);

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

  if (error) return (<><TopBar /><ErrorBox message={error} onRetry={load} /></>);
  if (!report) return (<><TopBar /><Loading label="Building your report… this can take a few seconds." /></>);

  const moment = report.moments.find((m) => m.id === selected);
  const avgUnderstanding = report.topics.length
    ? report.topics.reduce((a, t) => a + (t.understanding || 0), 0) / report.topics.length
    : null;
  const lowConfidence = report.participants < 6;

  return (
    <div className="min-h-screen pb-16">
      <TopBar>
        <button onClick={() => window.print()} className="btn-ghost text-sm">Print</button>
      </TopBar>
      <main className="mx-auto max-w-7xl space-y-6 px-6 pt-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="label">Lecture report</div>
            <h1 className="mt-1 text-3xl font-extrabold">
              {report.moments.length} moment{report.moments.length === 1 ? '' : 's'} where you lost the class
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
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm">
            Only {report.participants} students took part, so treat these numbers as a hint, not a verdict.
          </div>
        )}

        <Timeline report={report} selected={selected} onSelect={setSelected} />

        {report.moments.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {report.moments.map((m) => {
              const h = heat(m.score);
              return (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${selected === m.id ? 'border-pulse-500 bg-pulse-500/10' : 'border-slate-200 dark:border-slate-800'}`}
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
          <div className="card text-center text-slate-500">No confusion moments were detected. Nice lecture.</div>
        )}

        <RecapBox initial={report.recap} sessionId={report.sessionId} />

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
