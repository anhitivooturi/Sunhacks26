import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhisperStream } from '../whisper.js';
import { readPcmWav } from '../wav.js';

test('EC2 adapter batches PCM, preserves timing and flushes the last partial batch', async () => {
  const calls = [];
  const provider = await createWhisperStream({ env: { WHISPER_URL: 'https://transcribe.waitwhat.study', WHISPER_TOKEN: 'test-only' }, fetch: async (url, request) => {
    calls.push({ url, request });
    return { ok: true, json: async () => ({ segments: [{ start: 0, end: request.body.length / 32000, text: 'A recorded sentence.' }] }) };
  } });
  const audio = (async function* () { for (let i = 0; i < 45; i++) yield Buffer.alloc(3200); })();
  const output = [];
  for await (const chunk of provider.run(audio, new AbortController().signal)) output.push(chunk);
  assert.equal(calls.length, 2); assert.equal(calls[0].request.body.length, 128000); assert.equal(calls[1].request.body.length, 16000);
  assert.equal(calls[0].request.headers.Authorization, 'Bearer test-only');
  assert.deepEqual(output.map(c => [c.startSec, c.endSec]), [[0, 4], [4, 4.5]]);
});
test('EC2 failures surface so the browser can fall back', async () => {
  const provider = await createWhisperStream({ env: { WHISPER_URL: 'https://transcribe.waitwhat.study', WHISPER_TOKEN: 'test' }, fetch: async () => ({ ok: false, status: 503 }) });
  const audio = (async function* () { yield Buffer.alloc(3200); })();
  await assert.rejects(async () => { for await (const _ of provider.run(audio, new AbortController().signal)) {} }, /HTTP 503/);
  await assert.rejects(() => createWhisperStream({ env: { WHISPER_URL: 'http://example.com', WHISPER_TOKEN: 'test' } }), /HTTPS/);
});
test('WAV reader rejects unsupported and truncated recordings', () => {
  const wav = Buffer.alloc(48); wav.write('RIFF'); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4, 40);
  assert.equal(readPcmWav(wav).length, 4);
  wav.writeUInt32LE(48000, 24); assert.throws(() => readPcmWav(wav), /16 kHz/);
  assert.throws(() => readPcmWav(wav.subarray(0, 46)), /Truncated/);
});
