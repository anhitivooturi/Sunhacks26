import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { buildApp } from '../../live/src/app.js';
import { getConfig } from '../../live/src/config.js';
import { MemoryStore } from '../../live/src/store.js';
import { registerTranscription } from '../index.js';
import { AudioQueue } from '../queue.js';
import { Pcm16Resampler } from '../../../web/src/host/pcm.js';
import { createAI } from '../../ai/index.js';

async function until(fn) { const deadline = Date.now() + 3000; while (!fn()) { if (Date.now() > deadline) throw Error('Timed out'); await delay(10); } }
async function setup(t, createStream, env = { TRANSCRIBE_ENABLED: 'true' }) {
  let clock = 1700000000000;
  const store = new MemoryStore();
  const app = await buildApp({ store, config: getConfig({}), logger: false, now: () => clock, ai: createAI({ apiKey: '', logger: {}, fixtureCache: false }),
    register: (app, live) => registerTranscription(app, live, { env, now: () => clock, createStream }) });
  const base = (await app.listen({ host: '127.0.0.1', port: 0 })).replace('http', 'ws');
  t.after(() => app.close());
  const session = (await app.inject({ method: 'POST', url: '/sessions' })).json();
  const connect = async mode => {
    const ws = new WebSocket(`${base}/ws/audio?sessionId=${session.id}&mode=${mode}`), messages = [];
    ws.on('message', raw => messages.push(JSON.parse(raw)));
    await until(() => messages.some(m => m.type === 'ready' || m.type === 'error'));
    return { ws, messages };
  };
  return { app, store, session, base, connect, advance: ms => { clock += ms; } };
}
test('resampler preserves timing across 48 kHz and 44.1 kHz blocks and emits mono PCM16 LE', () => {
  for (const rate of [48000, 44100, 16000]) {
    const outputs = [];
    const pcm = new Pcm16Resampler(rate, data => outputs.push(data));
    for (let i = 0; i < rate; i += 128) pcm.push([new Float32Array(Math.min(128, rate - i)).fill(0.5)]);
    pcm.flush();
    assert.equal(outputs.reduce((sum, b) => sum + b.byteLength, 0), 32000);
    assert.equal(new DataView(outputs[0]).getInt16(0, true), 16384);
  }
  const output = [];
  const pcm = new Pcm16Resampler(16000, data => output.push(data));
  pcm.push([new Float32Array(1600).fill(1), new Float32Array(1600).fill(-1)]);
  assert.equal(new DataView(output[0]).getInt16(0, true), 0);
});
test('audio queue caps backlog and drains cleanly', async () => {
  const queue = new AudioQueue(4); queue.push(Buffer.alloc(4));
  assert.throws(() => queue.push(Buffer.alloc(2)), /backlog/); queue.end();
  let bytes = 0; for await (const chunk of queue) bytes += chunk.length;
  assert.equal(bytes, 4);
});
test('AWS partials broadcast, only finals persist, duplicate finals drop; reconnect timestamps keep t0', async t => {
  const createStream = async () => ({ async *run(audio) {
    for await (const _ of audio) {
      yield { id: 'one', text: 'A partial', final: false, startSec: 0, endSec: 0.1 };
      yield { id: 'one', text: 'A final sentence.', final: true, startSec: 0, endSec: 0.1 };
      yield { id: 'one', text: 'A final sentence.', final: true, startSec: 0, endSec: 0.1 };
    }
  }, close() {} });
  const { app, store, session, connect, advance } = await setup(t, createStream);
  advance(10000);
  const first = await connect('transcribe'); first.ws.send(Buffer.alloc(3200));
  await until(() => first.messages.some(m => m.type === 'transcript' && m.data.final));
  first.ws.send(JSON.stringify({ type: 'stop', data: {} }));
  await until(() => first.ws.readyState === WebSocket.CLOSED);
  let chunks = await store.getTranscript(session.id);
  assert.equal(chunks.length, 1); assert.equal(chunks[0].startSec, 9.9);
  assert.ok(first.messages.some(m => m.type === 'transcript' && !m.data.final));
  advance(20000);
  const second = await connect('transcribe'); second.ws.send(Buffer.alloc(3200));
  await until(() => second.messages.some(m => m.type === 'transcript' && m.data.final));
  await app.inject({ method: 'POST', url: `/sessions/${session.id}/end` });
  chunks = await store.getTranscript(session.id);
  assert.equal(chunks.length, 2); assert.equal(chunks[1].startSec, 29.9);
});
test('browser fallback uses only server times and rejects injected client timestamps', async t => {
  const { store, session, connect, advance } = await setup(t);
  const browser = await connect('browser');
  advance(5000); browser.ws.send(JSON.stringify({ type: 'speech_start', data: {} }));
  await delay(20); advance(2000);
  browser.ws.send(JSON.stringify({ type: 'transcript', data: { text: 'The base case stops recursion.', final: true } }));
  await until(() => browser.messages.some(m => m.type === 'transcript'));
  const chunks = await store.getTranscript(session.id);
  assert.deepEqual(chunks, [{ startSec: 5, endSec: 7, text: 'The base case stops recursion.' }]);
  browser.ws.send(JSON.stringify({ type: 'transcript', data: { text: 'Fake', final: true, startSec: 999 } }));
  await until(() => browser.messages.some(m => m.type === 'error'));
  assert.equal((await store.getTranscript(session.id)).length, 1);
});
test('provider errors offer fallback; unknown sessions are rejected before upgrading', async t => {
  const { connect, base } = await setup(t, async () => { throw Error('AWS credentials are missing'); });
  const client = await connect('transcribe');
  assert.equal(client.messages[0].data.fallback, 'browser');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base}/ws/audio?sessionId=00000000-0000-4000-8000-000000000099`);
    ws.on('error', () => {});
    ws.on('unexpected-response', (_req, response) => { assert.equal(response.statusCode, 404); response.resume(); ws.terminate(); resolve(); });
    ws.on('open', () => { ws.terminate(); reject(Error('Unexpected upgrade')); });
  });
});

test('disabled cloud mode never invokes the AWS provider; browser mode remains usable', async t => {
  let calls = 0;
  const { connect } = await setup(t, async () => { calls++; throw Error('must not run'); }, {});
  const cloud = await connect('transcribe');
  assert.equal(cloud.messages[0].data.code, 'transcribe_disabled');
  assert.equal(calls, 0);
  await until(() => cloud.ws.readyState === WebSocket.CLOSED);
  const browser = await connect('browser');
  assert.equal(browser.messages[0].type, 'ready');
});
