import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { buildApp } from '../src/app.js';
import { getConfig } from '../src/config.js';
import { MemoryStore } from '../src/store.js';
import { createJoinUrl } from '../../../web/src/lib/join-url.js';

test('production requires a public HTTPS origin; local development stays available', () => {
  for (const base of ['http://waitwhat.study', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://dev.localhost']) {
    assert.throws(() => getConfig({ NODE_ENV: 'production', BASE_URL: base }), /public HTTPS/);
  }
  for (const base of ['https://waitwhat.study/j', 'https://user:pass@waitwhat.study', 'https://waitwhat.study?x=1']) {
    assert.throws(() => getConfig({ BASE_URL: base }), /without a path or credentials/);
  }
  assert.equal(getConfig({ NODE_ENV: 'production', BASE_URL: 'https://waitwhat.study/' }).baseUrl, 'https://waitwhat.study');
  assert.equal(getConfig({}).baseUrl, 'http://localhost:3000');
});

test('public QR decodes to the exact displayed student link, including its class code', async t => {
  const config = getConfig({ NODE_ENV: 'production', BASE_URL: 'https://waitwhat.study' });
  const app = await buildApp({ config, store: new MemoryStore(), logger: false });
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/sessions', payload: {} });
  assert.equal(response.statusCode, 201);
  const session = response.json();
  const png = PNG.sync.read(Buffer.from(session.qrDataUrl.split(',')[1], 'base64'));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.ok(decoded, 'QR must be readable by a QR scanner');
  assert.equal(png.width, 600);
  assert.equal(decoded.data, session.joinUrl);
  assert.equal(decoded.data, createJoinUrl(session.code, 'https://waitwhat.study'));
  assert.equal(new URL(decoded.data).pathname, `/j/${session.code}`);
});

test('frontend join URLs support public hosting and mock development; malformed codes fail', () => {
  assert.equal(createJoinUrl('ABCD', 'https://waitwhat.study/host'), 'https://waitwhat.study/j/ABCD');
  assert.equal(createJoinUrl('ABCD', 'http://localhost:5173'), 'http://localhost:5173/j/ABCD');
  for (const code of ['', 'IOL0', 'ABCD/evil', undefined]) assert.throws(() => createJoinUrl(code, 'https://waitwhat.study'));
  assert.throws(() => createJoinUrl('ABCD', 'javascript:alert(1)'));
});
