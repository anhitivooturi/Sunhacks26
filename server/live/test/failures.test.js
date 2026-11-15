import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAI } from '../src/ai-adapter.js';
import { readFixture } from '../src/fixtures.js';
import { packMessage, unpackMessage } from '../src/protocol.js';
import { MemoryStore } from '../src/store.js';
import { buildApp } from '../src/app.js';
import { getConfig } from '../src/config.js';
import { WebSocket } from 'ws';
import { setTimeout as delay } from 'node:timers/promises';

const logger = { info() {}, warn() {} };
const demoReport = await readFixture('report');
test('missing, malformed, throwing and stalled AI calls use backup data', async () => {
  const ai = await loadAI(logger, 10, {
    splitTopics: async () => ({ invalid: true }),
    explainMoment: async () => { throw new Error('Provider unavailable'); },
    generateFix: async () => ({ quiz: [] }),
    generateRecap: async () => new Promise(() => {}),
  });
  const context = { passage: demoReport.moments[0].passage };
  assert.equal((await ai.splitTopics([{ endSec: 480 }])).length, 3);
  assert.equal((await ai.explainMoment(context)).whyConfusing, 'undefined_term');
  assert.equal((await ai.generateFix(context)).quiz.length, 3);
  assert.equal(await ai.generateRecap([], [], []), demoReport.recap);
});
test('failed durable reaction writes are not added to the live meter or cooldown', async t => {
  const store = new MemoryStore();
  const originalAppend = store.appendEvent.bind(store);
  let writesFail = true;
  store.appendEvent = async event => { if (writesFail) throw Object.assign(new Error('DB unavailable'), { code: '08006' }); return originalAppend(event); };
  const app = await buildApp({ store, logger: false, config: getConfig({}) });
  const base = await app.listen({ host: '127.0.0.1', port: 0 });
  t.after(() => app.close());
  const session = (await app.inject({ method: 'POST', url: '/sessions' })).json();
  const ws = new WebSocket(`${base.replace('http', 'ws')}/ws?code=${session.code}&role=student`);
  const messages = [];
  ws.on('message', raw => messages.push(unpackMessage(JSON.parse(raw.toString()))));
  const until = async fn => { const start = Date.now(); while (!fn()) { if (Date.now() - start > 3000) throw new Error('Timeout'); await delay(5); } };
  await until(() => messages.some(m => m.type === 'welcome'));
  ws.send(JSON.stringify(packMessage({ type: 'react', kind: 'lost' })));
  await until(() => messages.some(m => m.type === 'error'));
  assert.equal((await store.listEvents(session.id)).length, 0);
  assert.equal(app.live.rooms.meter(app.live.rooms.rooms.get(session.id)).score, 0);
  writesFail = false;
  ws.send(JSON.stringify(packMessage({ type: 'react', kind: 'lost' })));
  await until(() => store.events.length === 1);
  assert.equal(app.live.rooms.meter(app.live.rooms.rooms.get(session.id)).score, 1);
});
