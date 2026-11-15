import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMoments } from '../src/detect-moments.js';
import { demoEvents } from '../src/fixtures.js';

const event = (id, second, kind = 'lost') => ({ student_id: id, transcript_ts_sec: second, type: 'react', payload: { kind } });
test('fixture spikes map to preceding transcript windows', () => {
  const moments = detectMoments(demoEvents);
  assert.deepEqual(moments.map(m => [m.startSec, m.endSec, m.lostCount, m.active]), [[160, 178, 12, 20], [320, 338, 8, 20]]);
  assert.equal(moments[0].score, 0.6);
});
test('repeated taps by one student never meet the distinct-student minimum', () => {
  assert.deepEqual(detectMoments([event('a', 50), event('a', 51), event('a', 52)]), []);
});
test('below-threshold buckets are excluded, unrelated future students are ignored', () => {
  const events = Array.from({ length: 20 }, (_, i) => event(`s${i}`, 90, 'got_it'));
  events.push(event('s0', 100), event('s1', 101), event('s2', 102), event('future', 1000));
  assert.equal(detectMoments(events, 0.3).length, 0);
  assert.equal(detectMoments(events, 0.15)[0].active, 20);
});
test('adjacent candidates merge using unions, separated candidates stay distinct', () => {
  const events = [50, 60, 90].flatMap(second => ['a', 'b', 'c'].map(id => event(id, second)));
  const result = detectMoments(events);
  assert.equal(result.length, 2);
  assert.deepEqual([result[0].startSec, result[0].endSec, result[0].lostCount, result[0].active], [30, 56, 3, 3]);
});
test('early reactions never produce a negative window', () => {
  assert.equal(detectMoments(['a', 'b', 'c'].map(id => event(id, 2)))[0].startSec, 0);
});
