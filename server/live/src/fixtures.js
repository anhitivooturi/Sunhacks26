// A's private backup data. Shared /fixtures are read if present and never written.
import { readFile } from 'node:fs/promises';

const lines = [
  'Recursion solves a problem by calling the same function on a smaller input.',
  'A base case stops the calls. For factorial, factorial of zero is one.',
  'For a positive integer n, factorial of n is n times factorial of n minus one.',
  'For example, factorial of three calls factorial of two, then factorial of one.',
  'The stack frame preserves the continuation, so we just unwind it to get six.',
  'A stack frame is the saved state of one call. The continuation is what happens after that call returns.',
  'We skipped a step: factorial of one is one times factorial of zero, which is one.',
  'Next, a tree has a value and possibly smaller trees called children.',
  'Visit the root, recurse on every child, and combine the results using the recurrence.',
  'A recurrence is a rule that relates a problem to smaller versions of itself.',
  'For example, the number of nodes is one plus the counts of all child trees.',
  'Choose a base case, make progress toward it, and combine the smaller answers.',
];
export const demoTranscript = lines.map((text, i) => ({ startSec: i * 40, endSec: (i + 1) * 40, text }));
const quiz = [
  { q: 'What stops recursive calls?', options: ['A base case', 'A larger input', 'A new variable', 'A print statement'], answerIndex: 0, explanation: 'The base case returns without another recursive call.' },
  { q: 'What is saved in a stack frame?', options: ['Every possible input', 'The state of one call', 'Only the final result', 'A copy of the whole program'], answerIndex: 1, explanation: 'Each frame saves the state needed to continue one call.' },
  { q: 'Why use a smaller input?', options: ['To avoid a return value', 'To skip all work', 'To approach the base case', 'To remove the function'], answerIndex: 2, explanation: 'Smaller inputs make progress toward a stopping condition.' },
];
export const demoReport = {
  sessionId: '00000000-0000-4000-8000-000000000001', durationSec: 480, participants: 20,
  topics: [
    { start: 0, end: 160, title: 'Recursive calls and stopping', confusion: 0.05, questions: 0, understanding: 0.8 },
    { start: 160, end: 280, title: 'Returning from calls', confusion: 0.6, questions: 1, understanding: 0.3 },
    { start: 280, end: 480, title: 'Recursion on trees', confusion: 0.4, questions: 1, understanding: 0.5 },
  ],
  moments: [
    { id: 'demo-moment-1', startSec: 160, endSec: 186, score: 0.6, lostCount: 12, active: 20,
      passage: lines[4], whyConfusing: 'undefined_term', evidenceQuote: 'The stack frame preserves the continuation',
      reexplanation: 'Each recursive call saves where it should resume. When a smaller call returns, the saved call continues its multiplication.',
      example: 'factorial(3) waits for factorial(2) = 2, then returns 3 times 2 = 6.', quiz },
    { id: 'demo-moment-2', startSec: 320, endSec: 346, score: 0.4, lostCount: 8, active: 20,
      passage: lines[8], whyConfusing: 'undefined_term', evidenceQuote: 'combine the results using the recurrence',
      reexplanation: 'Apply the same counting rule to each smaller tree. Add their counts and include the current node.',
      example: 'A root with two leaf children has 1 + 1 + 1 = 3 nodes.', quiz },
  ],
  unanswered: [{ id: 'demo-question-1', text: 'What is a continuation?', upvotes: 3, answered: false, transcript_ts_sec: 187 }],
  recap: 'I will revisit how a recursive call saves its state and resumes when the smaller call returns. We will trace factorial of three one step at a time, then count the nodes in a small tree.',
};

export const demoEvents = [];
for (let i = 0; i < 20; i++) {
  for (const second of [150, 310, 470]) demoEvents.push({ student_id: `demo-student-${i}`, type: 'react', transcript_ts_sec: second, payload: { kind: 'got_it' } });
  if (i < 12) demoEvents.push({ student_id: `demo-student-${i}`, type: 'react', transcript_ts_sec: 180 + (i % 3), payload: { kind: 'lost' } });
  if (i < 8) demoEvents.push({ student_id: `demo-student-${i}`, type: 'react', transcript_ts_sec: 340 + (i % 3), payload: { kind: 'lost' } });
}
demoEvents.push({ student_id: 'demo-student-0', type: 'question', transcript_ts_sec: 187, payload: { questionId: 'demo-question-1', text: 'What is a continuation?' } });
demoEvents.sort((a, b) => a.transcript_ts_sec - b.transcript_ts_sec);

export async function readFixture(name) {
  try { return JSON.parse(await readFile(new URL(`../../../fixtures/${name}.json`, import.meta.url), 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Cannot read shared fixture ${name}: ${error.message}`);
    return structuredClone({ report: demoReport, transcript: demoTranscript, events: demoEvents }[name]);
  }
}

export function normalizeChunks(value) {
  const chunks = Array.isArray(value) ? value : value.chunks;
  if (!Array.isArray(chunks)) throw new Error('Transcript fixture must be an array or {chunks: [...]}');
  return chunks.map(c => ({ startSec: Number(c.startSec ?? c.start_sec), endSec: Number(c.endSec ?? c.end_sec), text: c.text }));
}

export function normalizeEvents(value) {
  const events = Array.isArray(value) ? value : value.events;
  if (!Array.isArray(events)) throw new Error('Events fixture must be an array or {events:[...]}');
  const kinds = new Set(['lost', 'slow', 'fast', 'got_it', 'slow_down', 'speed_up']);
  return events.map(event => {
    const payload = { ...event.payload };
    const type = kinds.has(event.type) ? 'react' : event.type;
    if (type === 'react') {
      const kind = payload.kind || event.type;
      payload.kind = ({ slow_down: 'slow', speed_up: 'fast' })[kind] || kind;
    }
    return { ...event, student_id: event.student_id ?? event.studentId ?? null,
      transcript_ts_sec: Number(event.transcript_ts_sec ?? event.transcriptTsSec),
      created_at: event.created_at ?? event.createdAt, type, payload };
  });
}
