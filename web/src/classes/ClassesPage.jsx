import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TopBar, Loading } from '../components/Chrome.jsx';
import { useTitle } from '../lib/theme.js';
import { fmtTime, heat, pct } from '../lib/format.js';
import { fmtDate, fmtDateTime, listSessions } from '../lib/classes.js';
import BarChart from './BarChart.jsx';

// After class: two calm views.
// 1. "All your classes": a few numbers, one chart, and the topics that keep losing students.
// 2. "One class": pick course → section → lecture; see that class's trend and open any lecture's report.
// Filters live in the URL (?course=&section=&lecture=) so a link opens the same view.
export default function ClassesPage() {
  useTitle('Your classes');
  const [sessions, setSessions] = useState(null);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    listSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  if (!sessions) return (<><TopBar /><Loading label="Loading your classes…" /></>);

  return (
    <div className="min-h-screen pb-20">
      <TopBar />
      <main className="mx-auto max-w-6xl space-y-14 px-6 pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="hero-title" style={{ fontSize: "clamp(2.6rem, 5vw, 4.2rem)" }}>Your <span className="hl hero-hl">classes</span></h1>
          <Link to="/host" className="btn-primary">Start a class</Link>
        </header>

        {!sessions.length ? (
          <p className="text-slate-500">No classes yet. Start one, and after you end it, its report and numbers show up here.</p>
        ) : (
          <>
            <Overall sessions={sessions} />
            <OneClass sessions={sessions} params={params} setParams={setParams} />
          </>
        )}
      </main>
    </div>
  );
}

function Overall({ sessions }) {
  const nav = useNavigate();
  const done = sessions.filter((s) => s.peakLost != null);
  const avgPeak = avg(done.map((s) => s.peakLost));
  const avgStudents = Math.round(avg(done.map((s) => s.participants)) || 0);
  const questions = done.reduce((a, s) => a + (s.questions || 0), 0);
  const firstHalf = avg(done.slice(0, Math.ceil(done.length / 2)).map((s) => s.peakLost));
  const secondHalf = avg(done.slice(Math.ceil(done.length / 2)).map((s) => s.peakLost));
  const trend = firstHalf != null && secondHalf != null ? secondHalf - firstHalf : null;

  // Topics that keep losing students, across every class.
  const topics = useMemo(() => {
    const m = {};
    done.forEach((s) => {
      if (!s.worstTopic) return;
      const t = (m[s.worstTopic] ||= { topic: s.worstTopic, count: 0, peak: 0, courses: new Set() });
      t.count += 1;
      t.peak += s.peakLost;
      t.courses.add(s.course);
    });
    return Object.values(m)
      .map((t) => ({ ...t, peak: t.peak / t.count, courses: [...t.courses] }))
      .sort((a, b) => b.count - a.count || b.peak - a.peak)
      .slice(0, 5);
  }, [done]);

  return (
    <section aria-labelledby="overall-h" className="space-y-6">
      <h2 id="overall-h" className="display text-2xl">How your classes are going</h2>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Tile label="Lectures" value={done.length} />
        <Tile label="Students per class" value={avgStudents} />
        <Tile label="Lost at the worst moment" value={pct(avgPeak)} note="average · lower is better" />
        <Tile
          label="Trend"
          value={trend == null ? '—' : trend < 0 ? `${Math.round(-trend * 100)} pts better` : `${Math.round(trend * 100)} pts worse`}
          note="recent lectures vs earlier ones"
          tone={trend == null ? null : trend < 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="card">
        <BarChart
          data={done.map((s) => ({
            id: s.id,
            value: s.peakLost,
            label: `${s.course} · ${s.title || 'Lecture'}`,
            date: fmtDate(s.startedAt),
            short: shortDate(s.startedAt),
            extra: s.worstTopic ? `Hardest part: ${s.worstTopic}` : null,
          }))}
          onSelect={(id) => nav(`/report/${id}`)}
        />
      </div>

      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          <h3 className="label mb-3">Topics that keep losing students</h3>
          <ol className="space-y-3">
            {topics.map((t) => (
              <li key={t.topic} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1">
                <span className="font-medium">{t.topic}</span>
                <span className="text-sm tabular-nums text-slate-500">
                  {t.count} lecture{t.count === 1 ? '' : 's'} · {pct(t.peak)} lost
                </span>
                <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden>
                  <span className="block h-full origin-left rounded-full bg-[#e5402e] dark:bg-[#f2503d]" style={{ transform: `scaleX(${t.peak})` }} />
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="label mb-3">Questions</h3>
          <p className="display text-5xl tabular-nums">{questions}</p>
          <p className="mt-1 text-sm text-slate-500">anonymous questions asked across all lectures</p>
        </div>
      </div>
    </section>
  );
}

function OneClass({ sessions, params, setParams }) {
  // Default to the class taught most recently; the URL wins when it names one.
  const latest = sessions[sessions.length - 1];
  const courses = unique(sessions.map((s) => s.course));
  const course = params.get('course') && courses.includes(params.get('course')) ? params.get('course') : latest?.course || '';
  const sections = unique(sessions.filter((s) => s.course === course).map((s) => s.section || ''));
  const wanted = params.get('section') ?? (latest?.course === course ? latest.section || '' : null);
  const section = sections.includes(wanted) ? wanted : sections[0] ?? '';
  const lectures = sessions.filter((s) => s.course === course && (s.section || '') === section);
  const lectureId = lectures.some((l) => l.id === params.get('lecture')) ? params.get('lecture') : lectures[lectures.length - 1]?.id;
  const lecture = lectures.find((l) => l.id === lectureId);

  const update = (patch) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        Object.entries(patch).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)));
        return next;
      },
      { replace: true }
    );

  return (
    <section aria-labelledby="one-h" className="space-y-6">
      <h2 id="one-h" className="display text-2xl">One class</h2>

      <div className="flex flex-wrap gap-4">
        <Select label="Course" value={course} onChange={(v) => update({ course: v, section: null, lecture: null })} options={courses.map((c) => [c, c])} />
        <Select label="Section" value={section} onChange={(v) => update({ section: v, lecture: null })} options={sections.map((s) => [s, s || 'No section'])} />
        <Select
          label="Lecture"
          value={lectureId || ''}
          onChange={(v) => update({ lecture: v })}
          options={[...lectures].reverse().map((l) => [l.id, `${fmtDate(l.startedAt)} · ${l.title || 'Lecture'}`])}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="card">
          <div className="mb-3 font-semibold">{course}{section ? ` · ${section}` : ''}</div>
          <BarChart
            height={200}
            selectedId={lectureId}
            onSelect={(id) => update({ lecture: id })}
            data={lectures.map((s) => ({
              id: s.id,
              value: s.peakLost ?? 0,
              label: s.title || 'Lecture',
              date: fmtDate(s.startedAt),
              short: shortDate(s.startedAt),
              extra: s.worstTopic ? `Hardest part: ${s.worstTopic}` : null,
            }))}
          />
        </div>

        {lecture && <LectureCard lecture={lecture} />}
      </div>
    </section>
  );
}

function LectureCard({ lecture: l }) {
  const h = heat(l.peakLost ?? 0);
  return (
    <div className="card flex flex-col gap-4">
      <div>
        <div className="text-sm text-slate-500">{fmtDateTime(l.startedAt)}</div>
        <div className="display mt-1 text-2xl">{l.title || 'Lecture'}</div>
      </div>
      {l.peakLost == null ? (
        <p className="text-sm text-slate-500">This class hasn’t been ended yet, so there’s no report.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Worst moment</dt>
              <dd className={`display text-3xl tabular-nums ${h.text}`}>{pct(l.peakLost)}</dd>
              <dd className="text-slate-500">of students lost</dd>
            </div>
            <div>
              <dt className="text-slate-500">Students</dt>
              <dd className="display text-3xl tabular-nums">{l.participants}</dd>
              <dd className="text-slate-500">{l.durationSec ? `${fmtTime(l.durationSec)} long` : ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">“Wait, what?” moments</dt>
              <dd className="text-lg font-semibold tabular-nums">{l.moments}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Questions</dt>
              <dd className="text-lg font-semibold tabular-nums">{l.questions}</dd>
            </div>
          </dl>
          {l.worstTopic && (
            <p className="text-sm">
              Hardest part: <span className="evidence">{l.worstTopic}</span>
            </p>
          )}
          <Link to={`/report/${l.id}`} className="btn-primary mt-auto">Open full report →</Link>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, note, tone }) {
  const color = tone === 'good' ? 'text-emerald-600 dark:text-got' : tone === 'bad' ? 'text-red-600 dark:text-pulse-400' : '';
  return (
    <div>
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`display mt-1 text-3xl tabular-nums ${color}`}>{value}</div>
      {note && <div className="text-xs text-slate-500">{note}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  const id = `sel-${label.toLowerCase()}`;
  return (
    <label htmlFor={id} className="block min-w-[12rem]">
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-[#fff] px-3 py-2.5 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
    </label>
  );
}

const unique = (arr) => [...new Set(arr)];
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
