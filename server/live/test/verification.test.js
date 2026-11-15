import test from 'node:test';
import assert from 'node:assert/strict';
import { computeResolved, verifyMoment } from '../src/verification.js';
const answer = (student, correct, qIndex = 0) => ({ type: 'quiz_answer', student_id: student, payload: { momentId: 'm', qIndex, correct } });
const moment = { id: 'm', score: 0.8, startSec: 10, endSec: 20, active: 20 };
test('latest answer counts once and no data stays unknown', () => {
  assert.equal(computeResolved([], 'm'), null);
  assert.equal(computeResolved([answer('a', false), answer('a', true), answer('b', false)], 'm'), 0.5);
});
test('all-correct answers lower confusion without changing the original tap evidence', () => {
  const result = verifyMoment(moment, [answer('a', true)]);
  assert.equal(result.score, 0.52);
  assert.equal(result.originalScore, 0.8);
  assert.equal(result.confidence, 'low');
  assert.equal(verifyMoment(moment, []).score, 0.8);
});
