// Mock WebSocket for the host screens. Replays a short fake lecture on a timer:
// transcript lines, a meter that spikes during the confusing passage, questions, a live moment
// and quiz progress after a push_fix. Same interface as the real feed in lib/feed.js.

import { mockReport } from './report.js';

const LINES = [
  "Alright, today we're looking at recursion, a function that calls itself.",
  'Every recursive function needs a base case, the input where it stops.',
  "Let's write fib of n. If n is less than two, return n. That's our base case.",
  'Otherwise return fib of n minus one plus fib of n minus two.',
  'If you run fib of 50 this way, it basically never finishes.',
  'So once we have the recursive call, we just memoize it and the exponential blowup goes away.',
  'You store the subproblem results and the tree collapses into a line.',
  'Which is why fib of 50 suddenly runs instantly.',
  'Then the base case handles the rest.',
  "We've proven termination by induction on n, so the total work is linear.",
];

const QUESTIONS = [
  { id: 'q1', text: 'What does memoize mean?', upvotes: 0, answered: false },
  { id: 'q3', text: 'Is memoization the same as dynamic programming?', upvotes: 0, answered: false },
  { id: 'q5', text: 'Does Python have a built-in way to memoize?', upvotes: 0, answered: false },
];

export function createMockFeed() {
  const listeners = {};
  const timers = [];
  let questions = QUESTIONS.map((q) => ({ ...q }));
  let t = 0;
  let lineIdx = 0;
  let closed = false;

  const emit = (type, data) => (listeners[type] || []).forEach((cb) => cb(data));
  const sortQs = () => [...questions].sort((a, b) => Number(a.answered) - Number(b.answered) || b.upvotes - a.upvotes);

  // Emit after a tick so subscribers attached right after creation receive the first status.
  setTimeout(() => emit('status', 'mock'), 0);

  // One tick per second.
  timers.push(
    setInterval(() => {
      if (closed) return;
      t += 1;

      // A new transcript line every 4 s, shown as a partial first, then final.
      if (t % 4 === 1 && lineIdx < LINES.length) {
        const text = LINES[lineIdx];
        const startSec = t;
        emit('transcript', { text: text.split(' ').slice(0, 5).join(' ') + '…', final: false, startSec });
        setTimeout(() => !closed && emit('transcript', { text, final: true, startSec }), 1200);
        lineIdx += 1;
      }

      // Meter every 2 s, spiking after the "memoize" line (line 6, ~t=21).
      if (t % 2 === 0) {
        const active = Math.min(22, 6 + t);
        const spike = t >= 23 && t <= 34 ? 9 : t >= 40 && t <= 46 ? 6 : 1;
        const lostCount = Math.max(0, spike + Math.round(Math.random() * 2 - 1));
        emit('meter', { score: lostCount / Math.max(active, 1), lostCount, active });
      }

      // Questions arrive and gain upvotes.
      if (t === 25 || t === 31 || t === 44) {
        questions[t === 25 ? 0 : t === 31 ? 1 : 2].upvotes += 1;
      }
      if (t > 25 && t % 3 === 0) {
        const q = questions[Math.floor(Math.random() * questions.length)];
        if (q.upvotes > 0 && !q.answered) q.upvotes += 1;
      }
      if (t >= 25) emit('questions', { list: sortQs().filter((q) => q.upvotes > 0) });

      // Live moments as soon as they are "detected".
      if (t === 30) emit('moment', { moment: { ...mockReport.moments[0], startSec: 20, endSec: 30, resolved: null, quizAnswered: 0 } });
      if (t === 48) emit('moment', { moment: { ...mockReport.moments[1], startSec: 33, endSec: 40 } });

      if (lineIdx >= LINES.length && t > 60) {
        // Loop the demo lecture.
        t = 0;
        lineIdx = 0;
        questions = QUESTIONS.map((q) => ({ ...q }));
      }
    }, 1000)
  );

  return {
    on(type, cb) {
      (listeners[type] ||= []).push(cb);
      return () => (listeners[type] = listeners[type].filter((f) => f !== cb));
    },
    send(type, data) {
      if (type === 'mark_answered') {
        questions = questions.map((q) => (q.id === data.questionId ? { ...q, answered: true } : q));
        emit('questions', { list: sortQs().filter((q) => q.upvotes > 0) });
      }
      if (type === 'push_fix') {
        // Simulate students answering the check quiz.
        let answered = 0;
        const total = 21;
        const iv = setInterval(() => {
          if (closed) return clearInterval(iv);
          answered = Math.min(total, answered + 1 + Math.floor(Math.random() * 3));
          emit('quiz_progress', { momentId: data.momentId, answered, correctRate: 0.62 + (answered / total) * 0.2 });
          if (answered >= total) clearInterval(iv);
        }, 700);
        timers.push(iv);
      }
    },
    close() {
      closed = true;
      timers.forEach(clearInterval);
    },
  };
}
