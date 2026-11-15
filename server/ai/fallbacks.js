import { readFileSync } from 'node:fs';
const fixture = JSON.parse(readFileSync(new URL('../../fixtures/report.json', import.meta.url), 'utf8'));
const passage = context => String(typeof context === 'string' ? context : context?.passage || '').trim();
export function matchingMoment(context) {
  const text = passage(context);
  return fixture.moments.find(m => m.evidenceQuote && text.includes(m.evidenceQuote));
}
export const fallbacks = {
  splitTopics(chunks, durationSec) {
    if (!durationSec) return [];
    const count = Math.min(3, Math.max(1, chunks.length));
    return Array.from({ length: count }, (_, i) => ({ start: i * durationSec / count, end: (i + 1) * durationSec / count,
      title: `Lecture part ${i + 1}` }));
  },
  explainMoment(context) {
    const m = matchingMoment(context);
    return m ? { whyConfusing: m.whyConfusing, evidenceQuote: m.evidenceQuote, oneLineSummary: m.summary || 'Review the step highlighted in the passage.' }
      : { whyConfusing: 'skipped_step', evidenceQuote: '', oneLineSummary: 'Ask students which step needs clarification.' };
  },
  generateFix(context) {
    const m = matchingMoment(context);
    if (m) return { reexplanation: m.reexplanation, example: m.example, quiz: structuredClone(m.quiz) };
    const quote = passage(context).slice(0, 1800) || 'No transcript was captured.';
    return { reexplanation: `Review this recorded passage together: ${quote}`, example: 'Ask the professor to work through one example of this idea.', quiz: [
      { q: 'Which passage needs clarification?', options: [quote, 'A different lecture', 'The class code', 'An unrelated topic'], answerIndex: 0, explanation: 'Return to the passage students flagged.' },
      { q: 'What should we ask the professor to explain?', options: ['The classroom address', 'The unclear step', 'The session code', 'An unrelated subject'], answerIndex: 1, explanation: 'Identify the unclear step in this passage.' },
      { q: 'How can we check our understanding?', options: ['Skip this idea', 'Memorize the class code', 'Explain the idea back', 'Close the lecture'], answerIndex: 2, explanation: 'Explain the idea back and check it with the professor.' },
    ] };
  },
  generateRecap(topics, moments, unanswered) {
    if (moments.some(m => matchingMoment(m))) return fixture.recap.split(/\s+/).slice(0, 120).join(' ');
    const names = topics.slice(0, 4).map(t => t.title).join(', ');
    return `I will revisit ${names || 'the ideas from our lecture'} and work through the steps students flagged. ${unanswered.length ? 'I will also address the questions that remained unanswered.' : 'We will check understanding before moving on.'}`;
  },
  generateNotes(context, format) {
    const text = passage(context) || 'No transcript was captured.';
    const sentences = text.match(/[^.!?]+[.!?]*/g)?.map(s => s.trim()).filter(Boolean) || [text];
    if (format === 'flashcards') return { format, content: [
      { front: 'What does this passage say?', back: sentences[0] },
      { front: 'What should I review?', back: sentences.slice(1).join(' ') || 'Explain the recorded idea back to the professor.' },
    ] };
    if (format === 'bullets') return { format, content: sentences.slice(0, 5) };
    if (format === 'diagram') {
      const label = text.slice(0, 110).replace(/[^\p{L}\p{N} ,.'?-]/gu, ' ');
      return { format, content: `flowchart TD\n  A["${label}"] --> B["Review the steps with the professor"]` };
    }
    return { format: 'plain', content: text };
  },
};
