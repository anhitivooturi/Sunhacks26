import Fastify from 'fastify';
import cors from '@fastify/cors';
import QRCode from 'qrcode';
import { randomInt, randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { getConfig } from './config.js';
import { MemoryStore, PgStore } from './store.js';
import { Rooms, validId } from './rooms.js';
import { loadAI } from './ai-adapter.js';
import { buildReport } from './report.js';
import { readFixture } from './fixtures.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const sessionParams = { type: 'object', properties: { id: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' } }, required: ['id'] };

export async function buildApp(options = {}) {
  const config = options.config || getConfig();
  const app = Fastify({ logger: options.logger ?? { level: config.logLevel }, bodyLimit: 16384 });
  const store = options.store || (config.databaseUrl ? new PgStore(config.databaseUrl) : new MemoryStore());
  const ai = options.ai || await loadAI(app.log, config.aiTimeoutMs);
  const now = options.now || Date.now;
  const rooms = new Rooms({ store, logger: app.log, now });
  const upgrades = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16384, perMessageDeflate: false });
  if (store.pool) store.pool.on('error', error => app.log.error({ err: error }, 'Idle database connection error'));
  else app.log.warn('Memory mode: sessions disappear when the process restarts');
  await app.register(cors, { origin: config.corsOrigins });
  async function sessionOr404(id, reply) {
    const session = await store.getSession(id);
    if (!session) { reply.code(404).send({ error: 'Unknown session' }); return null; }
    return session;
  }
  app.get('/health', async () => ({ ok: true }));
  app.post('/sessions', { preValidation: async request => { request.body ??= {}; }, schema: { body: { type: 'object', additionalProperties: false, properties: {} } } }, async (_request, reply) => {
    let session;
    for (let attempt = 0; attempt < 20; attempt++) {
      const data = { id: randomUUID(), code: Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''), started_at: new Date(now()).toISOString(), ended_at: null };
      try { session = await store.createSession(data); break; }
      catch (error) { if (error.code !== '23505') throw error; }
    }
    if (!session) return reply.code(503).send({ error: 'Could not allocate a code; retry' });
    const joinUrl = `${config.baseUrl}/j/${session.code}`;
    return reply.code(201).send({ id: session.id, code: session.code, joinUrl, qrDataUrl: await QRCode.toDataURL(joinUrl) });
  });
  app.get('/sessions/:id/transcript', { schema: { params: sessionParams } }, async (request, reply) => {
    if (!await sessionOr404(request.params.id, reply)) return;
    return store.getTranscript(request.params.id);
  });
  app.get('/sessions/:id/report', { schema: { params: sessionParams } }, async (request, reply) => {
    if (!await sessionOr404(request.params.id, reply)) return;
    reply.header('Cache-Control', 'no-store');
    const saved = await store.getReport(request.params.id);
    if (saved) return saved.report;
    return { ...await readFixture('report'), sessionId: request.params.id };
  });
  app.post('/sessions/:id/end', { schema: { params: sessionParams } }, async (request, reply) => {
    if (!await sessionOr404(request.params.id, reply)) return;
    await rooms.serialize(request.params.id, async () => {
      const existing = await store.getReport(request.params.id);
      const session = await store.endSession(request.params.id, new Date(now()).toISOString());
      const room = rooms.rooms.get(session.id);
      if (room) room.session = session;
      if (existing) return existing.report;
      return buildReport({ store, session, ai, threshold: config.threshold });
    });
    return { ok: true };
  });

  app.server.on('upgrade', (request, socket, head) => {
    socket.on('error', error => app.log.debug({ err: error }, 'Upgrade socket failed'));
    const reject = (status, message) => { if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); };
    void (async () => {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname !== '/ws') {
        const handler = upgrades.get(url.pathname);
        if (handler) return handler(request, socket, head);
        return reject(404, 'Not Found');
      }
      const role = url.searchParams.get('role');
      const code = url.searchParams.get('code')?.toUpperCase();
      const studentId = url.searchParams.get('studentId');
      if (!['student', 'host'].includes(role) || !/^[A-HJKMNP-Z]{4}$/.test(code || '') || (studentId !== null && !validId(studentId))) return reject(400, 'Bad Request');
      const session = await store.findSession(code);
      if (!session) return reject(404, 'Not Found');
      // Load durable questions/cooldowns before accepting messages.
      await rooms.room(session);
      if (socket.destroyed) return;
      wss.handleUpgrade(request, socket, head, ws => {
        rooms.connect(ws, session, role, studentId).catch(error => { app.log.error({ err: error }, 'Room connect failed'); ws.close(1011, 'Room unavailable'); });
      });
    })().catch(error => { app.log.error({ err: error }, 'Upgrade failed'); reject(503, 'Service Unavailable'); });
  });

  const live = {
    store, rooms,
    getSession: id => store.getSession(id),
    broadcast: (sessionId, data, role) => rooms.broadcast(sessionId, data, role),
    serialize: (sessionId, task) => rooms.serialize(sessionId, task),
    registerUpgrade: (path, handler) => {
      if (path === '/ws' || upgrades.has(path)) throw new Error(`Upgrade route already registered: ${path}`);
      upgrades.set(path, handler);
    },
    publishTranscript: async (sessionId, chunk) => rooms.serialize(sessionId, async () => {
      const session = await store.getSession(sessionId);
      if (!session) throw new Error('Unknown session');
      if (session.ended_at) throw new Error('Session has ended');
      if (typeof chunk.text !== 'string' || chunk.text.length > 20000 || typeof chunk.final !== 'boolean' || !Number.isFinite(chunk.startSec) || chunk.startSec < 0) throw new Error('Invalid transcript chunk');
      if (chunk.final) {
        if (!Number.isFinite(chunk.endSec) || chunk.endSec < chunk.startSec) throw new Error('Final transcript needs valid endSec');
        await store.addTranscript(sessionId, { startSec: chunk.startSec, endSec: chunk.endSec, text: chunk.text });
      }
      rooms.broadcast(sessionId, { type: 'transcript', text: chunk.text, final: chunk.final, startSec: chunk.startSec });
    }),
  };
  app.decorate('live', live);
  // B or D may register their own plugin here using app + the live integration.
  if (options.register) await options.register(app, live);
  app.addHook('preClose', async () => { await rooms.close(); await new Promise(resolve => wss.close(resolve)); });
  app.addHook('onClose', async () => { await store.close(); });
  return app;
}
