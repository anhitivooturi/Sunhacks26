// Only the latest response from a student for a given quiz question counts.
export function latestAnswers(events, momentId) {
  const latest = new Map();
  for (const e of events) if (e.type === 'quiz_answer' && e.payload.momentId === momentId && e.student_id) {
    latest.set(`${e.student_id}:${e.payload.qIndex}`, e);
  }
  return [...latest.values()];
}
export function computeResolved(events, momentId) {
  const answers = latestAnswers(events, momentId);
  return answers.length ? answers.filter(e => e.payload.correct).length / answers.length : null;
}
export function verifyMoment(moment, events, originalScore = moment.score) {
  const answers = latestAnswers(events, moment.id);
  const resolved = computeResolved(events, moment.id);
  const relevantQuestions = events.filter(e => e.type === 'question' && e.transcript_ts_sec >= moment.startSec && e.transcript_ts_sec <= moment.endSec + 20);
  const participants = new Set(answers.map(e => e.student_id));
  const confidence = participants.size >= 15 ? 'high' : participants.size >= 5 ? 'medium' : 'low';
  const questionShare = Math.min(1, new Set(relevantQuestions.map(e => e.student_id)).size / Math.max(moment.active, 1));
  return {
    // No quiz evidence yet: retain the detected tap score.
    score: resolved === null ? originalScore : Math.min(1, 0.65 * originalScore + 0.25 * (1 - resolved) + 0.1 * questionShare),
    resolved, confidence, participants: participants.size, originalScore,
  };
}
