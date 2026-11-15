// Mock WebSocket for the host screens. Replays the shared demo lecture from /fixtures:
// transcript lines (partial, then final), a meter computed from the fixture Lost taps, questions
// and upvotes, live moments as the lecture passes them, and quiz progress after a push_fix.
// Same interface as the real feed in lib/feed.js.

import report from '@fixtures/report.json';
import transcript from '@fixtures/transcript.json';
import events from '@fixtures/events.json';

const SPEED = 6; // 1 real second = 6 lecture seconds
const LINE_MS = 2500;
const STUDENTS = new Set(events.map((e) => e.studentId)).size || 20;

export function createMockFeed() {
  const listeners = {};
  const timers = [];
  let closed = false;
  let lectureSec = 0;
  let i = 0;
  const sentMoments = new Set();

  const emit = (type, data) => !closed && (listeners[type] || []).forEach((cb) => cb(data));
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const every = (ms, fn) => timers.push(setInterval(fn, ms));

  const answeredIds = new Set();
  const questionsUpTo = (sec) =>
    events
      .filter((e) => e.type === 'question' && e.transcriptTsSec <= sec)
      .map((e) => ({
        id: e.payload.questionId,
        text: e.payload.text,
        upvotes: 1 + events.filter((u) => u.type === 'upvote' && u.payload.questionId === e.payload.questionId && u.transcriptTsSec <= sec).length,
        answered: answeredIds.has(e.payload.questionId),
      }))
      .sort((a, b) => Number(a.answered) - Number(b.answered) || b.upvotes - a.upvotes);

  later(0, () => emit('status', 'mock'));

  // Transcript: one chunk every LINE_MS, partial first, then final.
  const nextLine = () => {
    if (i >= transcript.length) {
      // Loop the demo lecture.
      i = 0;
      sentMoments.clear();
    }
    const c = transcript[i++];
    lectureSec = c.startSec;
    emit('transcript', { text: c.text.slice(0, Math.ceil(c.text.length * 0.5)) + '…', final: false, startSec: c.startSec });
    later(900, () => emit('transcript', { text: c.text, final: true, startSec: c.startSec }));
  };
  nextLine();
  every(LINE_MS, nextLine);

  // Lecture clock advances smoothly between lines.
  every(1000, () => {
    lectureSec += SPEED;
  });

  // Meter every 2 s: distinct Lost taps in the last 30 lecture seconds.
  every(2000, () => {
    const sec = lectureSec;
    const lost = new Set(events.filter((e) => e.type === 'lost' && e.transcriptTsSec <= sec && e.transcriptTsSec > sec - 30).map((e) => e.studentId)).size;
    const active = Math.min(STUDENTS, new Set(events.filter((e) => e.transcriptTsSec <= sec + 20).map((e) => e.studentId)).size || 1);
    emit('meter', { score: lost / Math.max(active, 1), lostCount: lost, active });

    emit('questions', { list: questionsUpTo(sec) });

    // A moment is announced once the lecture passes its end.
    report.moments.forEach((m) => {
      if (!sentMoments.has(m.id) && sec >= m.endSec) {
        sentMoments.add(m.id);
        emit('moment', { moment: { ...m, resolved: null, quizAnswered: 0 } });
      }
    });
  });

  return {
    on(type, cb) {
      (listeners[type] ||= []).push(cb);
      return () => (listeners[type] = listeners[type].filter((f) => f !== cb));
    },
    send(type, data) {
      if (type === 'mark_answered') {
        answeredIds.add(data.questionId);
        emit('questions', { list: questionsUpTo(lectureSec) });
      }
      if (type === 'push_fix') {
        // Simulate the class answering the check quiz.
        const total = STUDENTS;
        let answered = 0;
        const iv = setInterval(() => {
          answered = Math.min(total, answered + 1 + Math.floor(Math.random() * 3));
          emit('quiz_progress', { momentId: data.momentId, answered, correctRate: 0.6 + (answered / total) * 0.2 });
          if (answered >= total) clearInterval(iv);
        }, 700);
        timers.push(iv);
      }
    },
    close() {
      closed = true;
      timers.forEach((t) => {
        clearTimeout(t);
        clearInterval(t);
      });
    },
  };
}
