import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { setTimeout as delay } from 'node:timers/promises';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store.js';
import { getConfig } from '../src/config.js';
import { seedStore } from '../scripts/seed.js';
import { packMessage, unpackMessage } from '../src/protocol.js';

async function setup(t) {
  let clock = Date.now();
  const store = new MemoryStore();
  const app = await buildApp({ config: { ...getConfig({}), port: 0 }, store, logger: false, now: () => clock });
  const base = await app.listen({ host: '127.0.0.1', port: 0 });
  t.after(() => app.close());
  const create = await app.inject({ method: 'POST', url: '/sessions' });
  assert.equal(create.statusCode, 201, create.body);
  const session = create.json();
  const connect = async (role = 'student', studentId) => {
    const messages = [];
    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws?code=${session.code}&role=${role}${studentId ? `&studentId=${studentId}` : ''}`);
    ws.on('message', raw => messages.push(unpackMessage(JSON.parse(raw.toString()))));
    await until(() => messages.some(m => m.type === 'welcome'));
    return { ws, messages, studentId: messages.find(m => m.type === 'welcome').studentId };
  };
  return { app, store, session, base, connect, advance: ms => { clock += ms; } };
}
async function until(fn) {
  const end = Date.now() + 3000;
  while (!fn()) { if (Date.now() >= end) throw new Error('Timed out waiting for message'); await delay(10); }
}
const send = (client, message) => client.ws.send(JSON.stringify(packMessage(message)));
async function flushed(app, id) { await delay(30); await app.live.rooms.queues.get(id); }

test('health, unique QR sessions, fixture report and unknown session handling', async t => {
  const { app, session } = await setup(t);
  assert.deepEqual((await app.inject('/health')).json(), { ok: true });
  assert.match(session.code, /^[A-HJKMNP-Z]{4}$/);
  assert.equal(session.joinUrl, `http://localhost:3000/j/${session.code}`);
  assert.match(session.qrDataUrl, /^data:image\/png;base64,/);
  assert.equal((await app.inject(`/sessions/${session.id}/report`)).json().sessionId, session.id);
  assert.deepEqual((await app.inject(`/sessions/${session.id}/transcript`)).json(), []);
  assert.equal((await app.inject('/sessions/not-an-id/report')).statusCode, 400);
  assert.equal((await app.inject('/sessions/00000000-0000-4000-8000-000000000099/report')).statusCode, 404);
});
test('server timestamps, cooldown across reconnects, role enforcement and meter windows', async t => {
  const { app, store, session, connect, advance } = await setup(t);
  const host = await connect('host');
  const first = await connect();
  advance(10000);
  send(first, { type: 'react', kind: 'lost' });
  send(first, { type: 'react', kind: 'lost' });
  send(first, { type: 'react', kind: 'lost', transcript_ts_sec: 999 });
  send(first, { type: 'pulse_check' });
  await flushed(app, session.id);
  assert.equal((await store.listEvents(session.id)).length, 1);
  assert.equal((await store.listEvents(session.id))[0].transcript_ts_sec, 10);
  first.ws.terminate();
  const reconnected = await connect('student', first.studentId);
  send(reconnected, { type: 'react', kind: 'lost' });
  await flushed(app, session.id);
  assert.equal((await store.listEvents(session.id)).length, 1);
  assert.equal(reconnected.studentId, first.studentId);
  assert.deepEqual(app.live.rooms.meter(app.live.rooms.rooms.get(session.id)), { type: 'meter', score: 1, lostCount: 1, active: 1 });
  advance(31000);
  assert.equal(app.live.rooms.meter(app.live.rooms.rooms.get(session.id)).lostCount, 0);
  advance(120000);
  assert.equal(app.live.rooms.meter(app.live.rooms.rooms.get(session.id)).active, 0);
  send(host, { type: 'pulse_check' });
  await until(() => reconnected.messages.some(m => m.type === 'poll'));
});
test('questions rank unique votes, persist answered state and recover after room eviction', async t => {
  const { app, store, session, connect } = await setup(t);
  const host = await connect('host'), a = await connect(), b = await connect();
  send(a, { type: 'question', text: 'Why does recursion stop?' });
  await until(() => b.messages.some(m => m.type === 'questions' && m.list.length));
  const id = b.messages.filter(m => m.type === 'questions').at(-1).list[0].id;
  send(b, { type: 'upvote', questionId: id }); send(b, { type: 'upvote', questionId: id });
  await flushed(app, session.id);
  assert.equal((await store.listEvents(session.id)).filter(e => e.type === 'upvote').length, 1);
  send(host, { type: 'mark_answered', questionId: id });
  await until(() => b.messages.some(m => m.type === 'questions' && m.list[0]?.answered));
  for (const c of [a, b, host]) c.ws.terminate();
  await delay(30); app.live.rooms.rooms.delete(session.id);
  const c = await connect();
  assert.equal(c.messages.find(m => m.type === 'questions').list[0].answered, true);
});
test('transcript hook, spike detection and idempotent end preserve the frozen report keys', async t => {
  const { app, session, connect, advance } = await setup(t);
  const host = await connect('host');
  await app.live.publishTranscript(session.id, { text: 'A recursive call needs a base case.', startSec: 0, endSec: 25, final: true });
  await until(() => host.messages.some(m => m.type === 'transcript'));
  const students = await Promise.all([connect(), connect(), connect()]);
  advance(20000);
  for (const student of students) send(student, { type: 'react', kind: 'lost' });
  await flushed(app, session.id);
  advance(10000);
  const end = () => app.inject({ method: 'POST', url: `/sessions/${session.id}/end` });
  const [first, second] = await Promise.all([end(), end()]);
  assert.equal(first.statusCode, 200, first.body);
  assert.deepEqual(first.json(), second.json());
  assert.deepEqual(first.json(), { ok: true });
  const report = (await app.inject(`/sessions/${session.id}/report`)).json();
  assert.deepEqual(Object.keys(report).sort(), ['sessionId', 'durationSec', 'participants', 'topics', 'moments', 'unanswered', 'recap'].sort());
  assert.equal(report.moments.length, 1);
  assert.equal(report.participants, 3);
  assert.equal(report.moments[0].quiz.length, 3);
  assert.equal(report.durationSec, 30);
});
test('quiz correctness, fix relay and persisted verification update the same report', async t => {
  const { app, store, base } = await setup(t);
  const seeded = await seedStore(store);
  const seedReport = await store.getReport(seeded.id);
  // The shared backup session already contains quiz responses. Give this
  // isolated check its own moment identity so it tests one new response.
  seedReport.report.moments[0].id = 'quiz-under-test';
  await store.saveReport(seeded.id, seedReport.report, seedReport.verification);
  const messages = [];
  const student = new WebSocket(`${base.replace('http', 'ws')}/ws?code=${seeded.code}&role=student&studentId=quiz-student`);
  const host = new WebSocket(`${base.replace('http', 'ws')}/ws?code=${seeded.code}&role=host`);
  student.on('message', raw => messages.push(unpackMessage(JSON.parse(raw.toString()))));
  await until(() => messages.some(m => m.type === 'welcome') && host.readyState === WebSocket.OPEN);
  const original = (await store.getReport(seeded.id)).report.moments[0];
  host.send(JSON.stringify(packMessage({ type: 'push_fix', momentId: original.id })));
  await until(() => messages.some(m => m.type === 'push_fix'));
  student.send(JSON.stringify(packMessage({ type: 'quiz_answer', momentId: original.id, qIndex: 0, choice: original.quiz[0].answerIndex })));
  await flushed(app, seeded.id);
  const saved = await store.getReport(seeded.id);
  assert.equal(saved.verification[original.id].resolved, 1);
  assert.ok(saved.report.moments[0].score < original.score);
  assert.equal((await store.listEvents(seeded.id)).findLast(e => e.type === 'quiz_answer' && e.payload.momentId === original.id).payload.correct, true);
  student.terminate(); host.terminate();
});
test('unknown join codes are rejected before WebSocket upgrade', async t => {
  const { base } = await setup(t);
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws?code=ZZZZ&role=student`);
    ws.once('unexpected-response', (_req, response) => { assert.equal(response.statusCode, 404); response.resume(); ws.terminate(); resolve(); });
    ws.on('error', () => {});
    ws.once('open', () => { ws.terminate(); reject(new Error('Unexpected upgrade')); });
  });
});
