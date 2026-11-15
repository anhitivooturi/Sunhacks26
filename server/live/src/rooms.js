import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { makeEvent } from './store.js';
import { rankQuestions } from './questions.js';
import { refreshVerification } from './report.js';
import { packMessage, unpackMessage } from './protocol.js';

const REACTIONS = new Set(['lost', 'slow', 'fast', 'got_it']);
const STUDENT_TYPES = new Set(['react', 'question', 'upvote', 'quiz_answer']);
const HOST_TYPES = new Set(['push_fix', 'pulse_check', 'mark_answered']);
const fail = message => { throw new Error(message); };
const validId = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(x);
export { validId };

export class Rooms {
  constructor({ store, logger, now = Date.now }) {
    this.store = store; this.logger = logger; this.now = now;
    this.rooms = new Map(); this.loads = new Map(); this.queues = new Map();
    this.timer = setInterval(() => this.tick(), 2000);
    this.timer.unref();
  }
  serialize(id, task) {
    const prior = this.queues.get(id) || Promise.resolve();
    const next = prior.catch(() => {}).then(task);
    this.queues.set(id, next);
    next.finally(() => { if (this.queues.get(id) === next) this.queues.delete(id); }).catch(() => {});
    return next;
  }
  async room(session) {
    if (this.rooms.has(session.id)) return this.rooms.get(session.id);
    if (!this.loads.has(session.id)) {
      const pending = this.store.listEvents(session.id).then(events => {
        const room = { session, events, clients: new Set(), touched: this.now(), pending: 0, cooldowns: new Map() };
        for (const e of events) if (e.type === 'react') room.cooldowns.set(`${e.student_id}:${e.payload.kind}`, new Date(e.created_at).getTime());
        this.rooms.set(session.id, room); return room;
      }).finally(() => this.loads.delete(session.id));
      this.loads.set(session.id, pending);
    }
    return this.loads.get(session.id);
  }
  send(ws, data) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1024 * 1024) { ws.close(1013, 'Slow connection; reconnect'); return; }
    ws.send(JSON.stringify(packMessage(data)), error => { if (error) this.logger.warn({ err: error }, 'WebSocket send failed'); });
  }
  broadcast(sessionId, data, role) {
    const room = this.rooms.get(sessionId);
    if (room) for (const ws of room.clients) if (!role || ws.role === role) this.send(ws, data);
  }
  meter(room) {
    const second = Math.max(0, (this.now() - new Date(room.session.started_at).getTime()) / 1000);
    const active = new Set(room.events.filter(e => e.student_id && e.transcript_ts_sec > second - 120 && e.transcript_ts_sec <= second).map(e => e.student_id)).size;
    const lostCount = new Set(room.events.filter(e => e.student_id && e.type === 'react' && e.payload.kind === 'lost' && e.transcript_ts_sec > second - 30 && e.transcript_ts_sec <= second).map(e => e.student_id)).size;
    return { type: 'meter', score: lostCount / Math.max(active, 1), lostCount, active };
  }
  tick() {
    for (const [id, room] of this.rooms) {
      if (room.clients.size) {
        this.broadcast(id, this.meter(room), 'host');
        for (const ws of room.clients) {
          // Ping every ~30 seconds; close dead connections at the next heartbeat.
          if (this.now() - (ws.lastPing || 0) < 30000) continue;
          if (!ws.alive) { ws.terminate(); continue; }
          ws.alive = false; ws.lastPing = this.now(); ws.ping();
        }
      } else if (!room.pending && this.now() - room.touched > 600000) this.rooms.delete(id);
    }
  }
  async connect(ws, session, role, studentId) {
    const room = await this.room(session);
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.role = role; ws.studentId = role === 'student' ? studentId || randomUUID() : null;
    ws.alive = true; ws.lastPing = this.now();
    room.clients.add(ws); room.touched = this.now();
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', error => this.logger.warn({ err: error }, 'WebSocket connection failed'));
    ws.on('close', () => { room.clients.delete(ws); room.touched = this.now(); });
    ws.on('message', (raw, binary) => {
      if (room.pending >= 1000) { ws.close(1013, 'Room busy; reconnect'); return; }
      room.pending++;
      // Capture receive time, rather than a possibly delayed database-write time.
      const receivedAt = this.now();
      this.serialize(session.id, async () => {
        if (binary) fail('Use JSON text messages');
        let message;
        try { message = JSON.parse(raw.toString()); } catch { fail('Invalid JSON'); }
        await this.handle(room, ws, unpackMessage(message), receivedAt);
      }).catch(error => {
        this.logger.debug({ err: error }, 'Rejected WebSocket message');
        this.send(ws, { type: 'error', message: error.code ? 'Storage unavailable; retry your action' : error.message });
      }).finally(() => { room.pending--; room.touched = this.now(); });
    });
    this.send(ws, { type: 'welcome', sessionId: session.id, studentId: ws.studentId });
    this.send(ws, { type: 'questions', list: rankQuestions(room.events) });
    if (role === 'host') this.send(ws, this.meter(room));
  }
  async handle(room, ws, m, receivedAt) {
    if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.type !== 'string') fail('Expected {type,...}');
    const allowed = ws.role === 'student' ? STUDENT_TYPES : HOST_TYPES;
    if (!allowed.has(m.type)) fail('Message type is not allowed for this role');
    const keys = { react: ['type', 'kind'], question: ['type', 'text'], upvote: ['type', 'questionId'], quiz_answer: ['type', 'momentId', 'qIndex', 'choice'], push_fix: ['type', 'momentId'], pulse_check: ['type'], mark_answered: ['type', 'questionId'] };
    if (Object.keys(m).some(k => !keys[m.type].includes(k))) fail('Unexpected field; clients must not send timestamps');
    const session = await this.store.getSession(room.session.id);
    room.session = session;
    if (session.ended_at && ['react', 'question', 'pulse_check'].includes(m.type)) fail('Session has ended');
    let payload = {};
    let pushed;
    if (m.type === 'react') {
      if (!REACTIONS.has(m.kind)) fail('Invalid reaction kind');
      const previous = room.cooldowns.get(`${ws.studentId}:${m.kind}`);
      if (previous !== undefined && receivedAt - previous < 3000) return;
      payload = { kind: m.kind };
    }
    if (m.type === 'question') {
      if (typeof m.text !== 'string' || !m.text.trim() || m.text.trim().length > 1000) fail('Question must be 1–1000 characters');
      payload = { questionId: randomUUID(), text: m.text.trim() };
    }
    if (m.type === 'upvote' || m.type === 'mark_answered') {
      if (!validId(m.questionId)) fail('Invalid questionId');
      const question = rankQuestions(room.events).find(q => q.id === m.questionId);
      if (!question) fail('Unknown question');
      if ((m.type === 'mark_answered' && question.answered) || (m.type === 'upvote' && room.events.some(e => e.type === 'upvote' && e.student_id === ws.studentId && e.payload.questionId === m.questionId))) {
        // Retrying after a report-write failure should repair the projection
        // even though the original event was already committed.
        await refreshVerification(this.store, session.id);
        return;
      }
      payload = { questionId: m.questionId };
    }
    if (m.type === 'quiz_answer' || m.type === 'push_fix') {
      if (!validId(m.momentId)) fail('Invalid momentId');
      const saved = await this.store.getReport(session.id);
      const moment = saved?.report.moments.find(x => x.id === m.momentId);
      if (!moment) fail('Moment is not available; end the session to generate its report first');
      if (m.type === 'quiz_answer') {
        if (!Number.isInteger(m.qIndex) || !moment.quiz[m.qIndex] || !Number.isInteger(m.choice) || m.choice < 0 || m.choice >= moment.quiz[m.qIndex].options.length) fail('Invalid quiz answer');
        payload = { momentId: m.momentId, qIndex: m.qIndex, choice: m.choice, correct: m.choice === moment.quiz[m.qIndex].answerIndex };
      } else { payload = { momentId: m.momentId }; pushed = moment; }
    }
    const event = makeEvent(session, ws.studentId, m.type, payload, receivedAt);
    // Save first: a failed write must not appear as an accepted reaction/question.
    await this.store.appendEvent(event);
    room.events.push(event);
    if (m.type === 'react') room.cooldowns.set(`${ws.studentId}:${m.kind}`, receivedAt);
    if (['question', 'upvote', 'mark_answered'].includes(m.type)) this.broadcast(session.id, { type: 'questions', list: rankQuestions(room.events) });
    if (pushed) this.broadcast(session.id, { type: 'push_fix', moment: pushed });
    if (m.type === 'pulse_check') this.broadcast(session.id, { type: 'poll', kind: 'pulse_check' }, 'student');
    if (['quiz_answer', 'mark_answered', 'upvote'].includes(m.type)) await refreshVerification(this.store, session.id);
  }
  async close() {
    clearInterval(this.timer);
    for (const room of this.rooms.values()) for (const ws of room.clients) ws.terminate();
    await Promise.allSettled([...this.queues.values()]);
  }
}
