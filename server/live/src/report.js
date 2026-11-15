import { detectSessionMoments } from './detect-moments.js';
import { rankQuestions } from './questions.js';
import { verifyMoment } from './verification.js';

const reasons = new Set(['undefined_term', 'skipped_step', 'too_fast', 'no_example', 'assumed_prior_knowledge']);
const ratio = (n, d) => d ? n / d : 0;

function cleanTopics(value, durationSec) {
  if (!Array.isArray(value) || !value.length) return durationSec ? [{ start: 0, end: durationSec, title: 'Lecture' }] : [];
  const sorted = [...value].sort((a, b) => a.start - b.start);
  let end = 0;
  for (const t of sorted) {
    if (!Number.isFinite(t.start) || !Number.isFinite(t.end) || Math.abs(t.start - end) > 0.01 || t.end <= t.start || typeof t.title !== 'string' || !t.title.trim()) return [{ start: 0, end: durationSec, title: 'Lecture' }];
    end = t.end;
  }
  if (Math.abs(end - durationSec) > 1) return durationSec ? [{ start: 0, end: durationSec, title: 'Lecture' }] : [];
  return sorted.map(({ start, end, title }) => ({ start, end, title }));
}
export function validQuiz(quiz) {
  return Array.isArray(quiz) && quiz.length === 3 && quiz.every(q => typeof q.q === 'string' && typeof q.explanation === 'string' && Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => typeof o === 'string') && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < 4);
}

export async function buildReport({ store, session, ai, threshold }) {
  const [events, chunks, detected] = await Promise.all([store.listEvents(session.id), store.getTranscript(session.id), detectSessionMoments(store, session.id, threshold)]);
  const durationSec = Math.max(0, (new Date(session.ended_at) - new Date(session.started_at)) / 1000);
  const topicInput = await ai.splitTopics(chunks);
  const topics = cleanTopics(topicInput, durationSec).map(t => {
    const within = events.filter(e => e.transcript_ts_sec >= t.start && (e.transcript_ts_sec < t.end || (t.end === durationSec && e.transcript_ts_sec === t.end)));
    const reactions = within.filter(e => e.type === 'react');
    return { ...t, confusion: ratio(reactions.filter(e => e.payload.kind === 'lost').length, reactions.length),
      questions: within.filter(e => e.type === 'question').length,
      understanding: ratio(reactions.filter(e => e.payload.kind === 'got_it').length, reactions.length) };
  });
  const moments = [];
  // Serial calls keep demo API quotas predictable; every adapter call has a cap.
  for (const m of detected) {
    const passage = chunks.filter(c => c.endSec > m.startSec && c.startSec <= m.endSec).map(c => c.text).join(' ');
    const context = { passage, startSec: m.startSec, endSec: m.endSec, transcriptChunks: chunks };
    const [explanation, fix] = await Promise.all([ai.explainMoment(context), ai.generateFix(context)]);
    if (!validQuiz(fix.quiz)) throw new Error('AI generateFix must return exactly three valid four-option questions');
    const quote = typeof explanation.evidenceQuote === 'string' && passage.includes(explanation.evidenceQuote) && explanation.evidenceQuote.split(/\s+/).length <= 25 ? explanation.evidenceQuote : '';
    moments.push({ ...m, passage, whyConfusing: reasons.has(explanation.whyConfusing) ? explanation.whyConfusing : 'skipped_step', evidenceQuote: quote,
      reexplanation: String(fix.reexplanation || ''), example: String(fix.example || ''),
      quiz: fix.quiz.map(({ q, options, answerIndex, explanation }) => ({ q, options, answerIndex, explanation })) });
  }
  const unanswered = rankQuestions(events).filter(q => !q.answered);
  const report = { sessionId: session.id, durationSec, participants: new Set(events.map(e => e.student_id).filter(Boolean)).size,
    topics, moments, unanswered, recap: String(await ai.generateRecap(topics, moments, unanswered)) };
  const verification = Object.fromEntries(moments.map(m => [m.id, verifyMoment(m, events)]));
  await store.saveReport(session.id, report, verification);
  return report;
}

export async function refreshVerification(store, sessionId) {
  const saved = await store.getReport(sessionId);
  if (!saved) return;
  const events = await store.listEvents(sessionId);
  for (const moment of saved.report.moments) {
    const metrics = verifyMoment(moment, events, saved.verification[moment.id]?.originalScore ?? moment.score);
    moment.score = metrics.score;
    saved.verification[moment.id] = metrics;
  }
  saved.report.unanswered = rankQuestions(events).filter(q => !q.answered);
  await store.saveReport(sessionId, saved.report, saved.verification);
}
