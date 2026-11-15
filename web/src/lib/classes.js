// Class history: which course / section / lecture each session was, and a short summary of how it went.
// Real mode: GET /sessions (PROPOSED in docs/contract.md). Mock mode: a generated semester plus any
// sessions started on this device, so the Classes page always has something to show.
import { USE_MOCK } from './config.js';
import report from '@fixtures/report.json';

const KEY = 'pulse-class-history';
const LAST_KEY = 'pulse-last-class';

const read = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch { /* private mode */ }
};

// What the professor typed last time, so the start form is pre-filled (fill in what you already know).
export const lastClass = () => read(LAST_KEY, { course: '', section: '', title: '' });
export const rememberClass = (meta) => write(LAST_KEY, meta);

// Courses and sections taught before, for the start form's suggestions.
export async function knownCourses() {
  const list = await listSessions();
  const out = {};
  list.forEach((s) => {
    (out[s.course] ||= new Set()).add(s.section);
  });
  return Object.fromEntries(Object.entries(out).map(([c, set]) => [c, [...set]]));
}

// Called when a session starts on this device.
export function recordSession(s) {
  const list = read(KEY, []);
  write(KEY, [...list.filter((x) => x.id !== s.id), { ...s, local: true }]);
}

// Called when its report loads, so the history shows real numbers for it.
export function recordSummary(id, r) {
  const list = read(KEY, []);
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return;
  list[i] = { ...list[i], ...summarize(r) };
  write(KEY, list);
}

export function summarize(r) {
  const peak = Math.max(0, ...(r.moments || []).map((m) => m.score));
  const worstTopic = [...(r.topics || [])].sort((a, b) => b.confusion - a.confusion)[0];
  const questions = (r.topics || []).reduce((a, t) => a + (t.questions || 0), 0);
  return {
    durationSec: r.durationSec,
    participants: r.participants,
    peakLost: peak,
    moments: (r.moments || []).length,
    questions,
    worstTopic: worstTopic?.title || null,
    understanding: r.topics?.length ? r.topics.reduce((a, t) => a + (t.understanding || 0), 0) / r.topics.length : null,
  };
}

export async function getSessionMeta(id) {
  const list = await listSessions();
  return list.find((s) => s.id === id) || null;
}

export async function listSessions() {
  const local = read(KEY, []);
  if (!USE_MOCK) {
    try {
      const res = await fetch('/sessions');
      if (res.ok) {
        const remote = await res.json();
        const ids = new Set(remote.map((s) => s.id));
        return sortByDate([...remote, ...local.filter((s) => !ids.has(s.id))]);
      }
    } catch { /* fall back to what this device knows */ }
    return sortByDate(local);
  }
  const ids = new Set(local.map((s) => s.id));
  return sortByDate([...mockSemester().filter((s) => !ids.has(s.id)), ...local]);
}

const sortByDate = (list) => [...list].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

// ---------- mock semester ----------
// Two courses, a few weeks of lectures each. Deterministic, so the demo looks the same every time.
const PLAN = {
  'CSE 110': {
    sections: ['Section A · MWF 10:30', 'Section B · TTh 1:30'],
    titles: ['Variables and types', 'Conditionals', 'Loops', 'Methods', 'Arrays', 'Recursion', 'Memoization', 'Objects and classes', 'Inheritance', 'Exceptions'],
    topics: ['Base case and stack', 'Loop bounds', 'Method parameters', 'Array indexing', 'Return values'],
  },
  'CSE 205': {
    sections: ['Section 1 · MW 9:00'],
    titles: ['Big-O intro', 'Linked lists', 'Stacks and queues', 'Hash maps', 'Trees', 'Tree traversal', 'Heaps', 'Graphs'],
    topics: ['Big-O of nested loops', 'Pointer updates', 'Collision handling', 'Recursive traversal'],
  },
};

let cache;
function mockSemester() {
  if (cache) return cache;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const out = [];
  const now = new Date();
  Object.entries(PLAN).forEach(([course, p]) => {
    p.sections.forEach((section, si) => {
      p.titles.forEach((title, i) => {
        const daysAgo = (p.titles.length - i) * 3.5 + si;
        const d = new Date(now.getTime() - daysAgo * 86400000);
        d.setHours(si ? 13 : 10, 30, 0, 0);
        // Confusion trends down over the semester as the professor uses the fixes, with a spike on recursion.
        const spike = /Recursion|Memoization|traversal|Big-O/.test(title) ? 0.22 : 0;
        const peakLost = Math.min(0.85, Math.max(0.08, 0.5 - i * 0.025 + spike + (rnd() - 0.5) * 0.18));
        out.push({
          id: `mock-${course.replace(/\s/g, '')}-${si}-${i}`,
          course, section, title,
          startedAt: d.toISOString(),
          durationSec: 2700 + Math.round(rnd() * 900),
          participants: 34 + Math.round(rnd() * 30),
          peakLost: Math.round(peakLost * 100) / 100,
          moments: 1 + Math.round(peakLost * 5),
          questions: 2 + Math.round(rnd() * 14),
          worstTopic: p.topics[Math.floor(rnd() * p.topics.length)],
          understanding: Math.round((0.9 - peakLost * 0.6) * 100) / 100,
        });
      });
    });
  });
  // The demo lecture (the shared fixtures) is the most recent CSE 110 Section A class.
  out.push({
    id: 'demo', course: 'CSE 110', section: 'Section A · MWF 10:30', title: 'Recursion (demo)',
    startedAt: new Date(now.getTime() - 3600000).toISOString(), ...summarize(report),
  });
  cache = out;
  return out;
}

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
