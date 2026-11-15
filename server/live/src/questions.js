export function rankQuestions(events) {
  const questions = new Map();
  const votes = new Map();
  for (const event of events) {
    const p = event.payload;
    if (event.type === 'question') questions.set(p.questionId, {
      id: p.questionId, text: p.text, upvotes: 0, answered: false, transcript_ts_sec: event.transcript_ts_sec,
    });
    if (event.type === 'upvote') {
      if (!votes.has(p.questionId)) votes.set(p.questionId, new Set());
      if (event.student_id) votes.get(p.questionId).add(event.student_id);
    }
    if (event.type === 'mark_answered' && questions.has(p.questionId)) questions.get(p.questionId).answered = true;
  }
  for (const [id, q] of questions) q.upvotes = votes.get(id)?.size || 0;
  return [...questions.values()].sort((a, b) => Number(a.answered) - Number(b.answered) || b.upvotes - a.upvotes || a.transcript_ts_sec - b.transcript_ts_sec || a.id.localeCompare(b.id));
}
