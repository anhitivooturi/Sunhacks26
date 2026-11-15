import { access } from 'node:fs/promises';
import { readFixture } from './fixtures.js';
import { validQuiz } from './report.js';

// Person B can provide named exports from /server/ai/index.js or inject them
// into buildApp({ ai }). No files in B's directories are created or modified.
export async function loadAI(logger, timeoutMs = 20000, implementation) {
  const url = new URL('../../ai/index.js', import.meta.url);
  let module = implementation || {};
  try { if (!implementation) { await access(url); module = await import(url.href); } }
  catch (error) {
    if (error.code !== 'ENOENT') logger.warn({ err: error }, 'AI module failed to load; using backup');
  }
  const fixture = await readFixture('report');
  const valid = {
    splitTopics: value => Array.isArray(value) && value.every(t => Number.isFinite(t.start) && Number.isFinite(t.end) && typeof t.title === 'string'),
    explainMoment: value => typeof value?.whyConfusing === 'string' && typeof value?.evidenceQuote === 'string',
    generateFix: value => typeof value?.reexplanation === 'string' && typeof value?.example === 'string' && validQuiz(value?.quiz),
    generateRecap: value => typeof value === 'string',
  };
  const fallback = {
    splitTopics: async chunks => {
      const end = chunks.at(-1)?.endSec || 0;
      if (!end) return [];
      // Keep the fixture's titles while covering the actual session, without gaps.
      return fixture.topics.map((t, i, all) => ({ start: i * end / all.length, end: (i + 1) * end / all.length, title: t.title }));
    },
    explainMoment: async context => {
      const match = fixture.moments.find(m => context.passage.includes(m.evidenceQuote));
      return match ? { whyConfusing: match.whyConfusing, evidenceQuote: match.evidenceQuote } : { whyConfusing: 'skipped_step', evidenceQuote: '' };
    },
    generateFix: async context => {
      const match = fixture.moments.find(m => context.passage.includes(m.evidenceQuote));
      if (match) return { reexplanation: match.reexplanation, example: match.example, quiz: match.quiz };
      const quote = context.passage || 'No transcript was captured.';
      return { reexplanation: `Review this passage together: ${quote}`, example: 'Ask the lecturer to work through one concrete example of this passage.', quiz: [
        { q: 'Which passage are we reviewing?', options: [quote, 'A different lecture', 'A missing recording', 'An unrelated topic'], answerIndex: 0, explanation: 'Review the recorded passage with the lecturer.' },
        { q: 'What should we ask the lecturer to clarify?', options: ['An unrelated subject', 'The step that was unclear', 'The classroom address', 'The session code'], answerIndex: 1, explanation: 'Ask about the unclear step in the passage.' },
        { q: 'How can we check our understanding?', options: ['Skip the passage', 'Memorize the code', 'Explain the idea back', 'Close the lecture'], answerIndex: 2, explanation: 'Explaining the idea back can reveal missing steps.' },
      ] };
    },
    generateRecap: async () => fixture.recap,
  };
  return Object.fromEntries(Object.entries(fallback).map(([name, backup]) => [name, async (...args) => {
    if (typeof module[name] !== 'function') return backup(...args);
    let timer;
    const start = performance.now();
    try {
      const result = await Promise.race([Promise.resolve().then(() => module[name](...args)), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('AI timeout')), timeoutMs); })]);
      if (!valid[name](result)) throw new Error(`AI ${name} returned invalid output`);
      return result;
    } catch (error) { logger.warn({ err: error, function: name }, 'AI unavailable; using backup'); return backup(...args); }
    finally { clearTimeout(timer); logger.info({ function: name, latencyMs: Math.round(performance.now() - start) }, 'AI call'); }
  }]));
}
