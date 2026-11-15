import { WebSocket } from 'ws';
import { parseArgs } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store.js';
import { getConfig } from '../src/config.js';
import { packMessage, unpackMessage } from '../src/protocol.js';

const { values } = parseArgs({ options: {
  url: { type: 'string', default: 'http://localhost:3000' },
  students: { type: 'string', default: '60' }, seconds: { type: 'string', default: '300' },
  spike: { type: 'string', default: '30' }, interval: { type: 'string', default: '5000' },
  'self-contained': { type: 'boolean', default: false }, out: { type: 'string' },
} });
const students = Number(values.students), seconds = Number(values.seconds), spike = Number(values.spike), interval = Number(values.interval);
if (!Number.isInteger(students) || students < 1 || students > 1000 || !Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(spike) || spike < 0 || !Number.isFinite(interval) || interval < 3000) throw new Error('Use 1–1000 students, seconds > 0, spike >= 0 and interval >= 3000ms');
let app, store, baseUrl = values.url.replace(/\/$/, '');
const sockets = [], rtts = [], meterGaps = [];
let sent = 0, sendErrors = 0, serverErrors = 0, disconnects = 0, receivedMeters = 0, lastMeter;
const percentile = (items, percent) => [...items].sort((a, b) => a - b)[Math.max(0, Math.ceil(items.length * percent) - 1)] ?? null;
try {
  if (values['self-contained']) {
    store = new MemoryStore();
    app = await buildApp({ config: { ...getConfig(), port: 0 }, store, logger: false });
    baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  }
  const response = await fetch(`${baseUrl}/sessions`, { method: 'POST' });
  if (!response.ok) throw new Error(`Create session failed: ${response.status} ${await response.text()}`);
  const session = await response.json();
  const wsUrl = baseUrl.replace(/^http/, 'ws');
  const connect = (role, index) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsUrl}/ws?code=${session.code}&role=${role}${role === 'student' ? `&studentId=load-student-${index}` : ''}`);
    sockets.push(ws);
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('Welcome timeout')); }, 10000);
    ws.once('error', error => { clearTimeout(timer); reject(error); });
    ws.on('message', raw => {
      const m = unpackMessage(JSON.parse(raw.toString()));
      if (m.type === 'welcome') { clearTimeout(timer); resolve(ws); }
      if (m.type === 'error') serverErrors++;
      if (m.type === 'meter') { const t = performance.now(); if (lastMeter) meterGaps.push(t - lastMeter); lastMeter = t; receivedMeters++; }
    });
    ws.on('close', () => { disconnects++; });
  });
  const host = await connect('host', 0);
  const clients = await Promise.all(Array.from({ length: students }, (_, i) => connect('student', i)));
  console.log(`Session ${session.code}: ${students} students, ${seconds}s, lost spike at ${spike}s`);
  const started = performance.now();
  const kinds = ['got_it', 'slow', 'fast', 'got_it'];
  let nextSend = 0;
  while (performance.now() - started < seconds * 1000) {
    const elapsed = performance.now() - started;
    if (elapsed >= nextSend) {
      for (const ws of clients) {
        if (ws.readyState !== WebSocket.OPEN) { sendErrors++; continue; }
        const kind = elapsed / 1000 >= spike && elapsed / 1000 < spike + 10 ? 'lost' : kinds[Math.floor(Math.random() * kinds.length)];
        ws.send(JSON.stringify(packMessage({ type: 'react', kind })), error => { if (error) sendErrors++; }); sent++;
      }
      const pingAt = performance.now();
      host.ping();
      host.once('pong', () => rtts.push(performance.now() - pingAt));
      nextSend += interval;
    }
    await delay(Math.min(100, Math.max(1, seconds * 1000 - elapsed)));
  }
  // Wait for the final application writes; using the server queue is only
  // possible in self-contained mode. External mode cannot prove delivery.
  await delay(500);
  if (app) await Promise.allSettled([...app.live.rooms.queues.values()]);
  const persisted = store ? (await store.listEvents(session.id)).filter(e => e.type === 'react').length : null;
  const result = { students, durationSec: Number(((performance.now() - started) / 1000).toFixed(2)), sent,
    persisted, dropped: persisted === null ? null : sent - persisted, sendErrors, serverErrors,
    unexpectedDisconnects: disconnects, receivedMeters,
    pingRttP95Ms: percentile(rtts, 0.95), meterGapP95Ms: percentile(meterGaps, 0.95),
    note: store ? 'Local in-memory backend. Not a cloud/database/Wi-Fi benchmark.' : 'Delivery count is unknown in external mode; no per-reaction ACK exists in the frozen contract.' };
  console.log(JSON.stringify(result, null, 2));
  if (values.out) { await mkdir(dirname(values.out), { recursive: true }); await writeFile(values.out, JSON.stringify(result, null, 2) + '\n'); }
  if (sendErrors || serverErrors || disconnects || (result.dropped !== null && result.dropped !== 0)) process.exitCode = 1;
} finally {
  for (const ws of sockets) ws.terminate();
  if (app) await app.close();
}
