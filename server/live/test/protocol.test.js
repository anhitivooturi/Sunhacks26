import test from 'node:test';
import assert from 'node:assert/strict';
import { packMessage, unpackMessage } from '../src/protocol.js';
import { normalizeEvents, readFixture } from '../src/fixtures.js';
import { detectMoments } from '../src/detect-moments.js';

test('wire messages match the frozen {type,data} contract', () => {
  assert.deepEqual(packMessage({ type: 'react', kind: 'slow' }), { type: 'react', data: { kind: 'slow' } });
  assert.deepEqual(unpackMessage({ type: 'react', data: { kind: 'fast' } }), { type: 'react', kind: 'fast' });
  for (const invalid of [{ type: 'react', kind: 'lost' }, { type: 'react', data: null }, { type: 'react', data: [] }, { type: 'react', data: { type: 'pulse_check' } }]) assert.throws(() => unpackMessage(invalid));
});

test('Person D fixture events retain identities and times in the detector', async () => {
  const events = normalizeEvents(await readFixture('events'));
  assert.ok(events.every(e => Number.isFinite(e.transcript_ts_sec)));
  assert.ok(events.some(e => e.student_id && e.type === 'react' && e.payload.kind === 'lost'));
  const moments = detectMoments(events);
  assert.ok(moments.length >= 1);
  assert.ok(moments[0].lostCount >= 3);
});
