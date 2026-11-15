import pg from 'pg';
import { randomUUID } from 'node:crypto';

const clone = value => structuredClone(value);
export class MemoryStore {
  sessions = new Map(); events = []; chunks = []; reports = new Map();
  async createSession(session) {
    if ([...this.sessions.values()].some(s => s.code === session.code)) throw Object.assign(new Error('Duplicate code'), { code: '23505' });
    this.sessions.set(session.id, clone(session)); return clone(session);
  }
  async getSession(id) { return clone(this.sessions.get(id) || null); }
  async findSession(code) { return clone([...this.sessions.values()].find(s => s.code === code) || null); }
  async endSession(id, endedAt) { this.sessions.get(id).ended_at ??= endedAt; return this.getSession(id); }
  async appendEvent(event) { this.events.push(clone(event)); }
  async listEvents(id) { return clone(this.events.filter(e => e.session_id === id).sort((a, b) => a.transcript_ts_sec - b.transcript_ts_sec || a.created_at.localeCompare(b.created_at))); }
  async addTranscript(id, chunk) { this.chunks.push({ ...clone(chunk), session_id: id }); }
  async getTranscript(id) { return clone(this.chunks.filter(c => c.session_id === id).map(({ session_id, ...c }) => c).sort((a, b) => a.startSec - b.startSec)); }
  async getReport(id) { return clone(this.reports.get(id) || null); }
  async saveReport(id, report, verification = {}) { this.reports.set(id, clone({ report, verification })); }
  async close() {}
}

export class PgStore {
  constructor(connectionString) {
    // Honor the provider's sslmode/CA configuration; never disable cert checks.
    this.pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, query_timeout: 15000 });
  }
  async createSession(s) {
    return (await this.pool.query('INSERT INTO sessions(id,code,started_at,ended_at) VALUES($1,$2,$3,$4) RETURNING *', [s.id, s.code, s.started_at, s.ended_at])).rows[0];
  }
  async getSession(id) { return (await this.pool.query('SELECT * FROM sessions WHERE id=$1', [id])).rows[0] || null; }
  async findSession(code) { return (await this.pool.query('SELECT * FROM sessions WHERE code=$1', [code])).rows[0] || null; }
  async endSession(id, endedAt) { return (await this.pool.query('UPDATE sessions SET ended_at=coalesce(ended_at,$2) WHERE id=$1 RETURNING *', [id, endedAt])).rows[0]; }
  async appendEvent(e) {
    await this.pool.query('INSERT INTO events(id,session_id,student_id,type,transcript_ts_sec,created_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7)', [e.id, e.session_id, e.student_id, e.type, e.transcript_ts_sec, e.created_at, e.payload]);
  }
  async listEvents(id) { return (await this.pool.query('SELECT * FROM events WHERE session_id=$1 ORDER BY transcript_ts_sec,created_at,seq', [id])).rows; }
  async addTranscript(id, c) {
    await this.pool.query('INSERT INTO transcript_chunks(session_id,start_sec,end_sec,text) VALUES($1,$2,$3,$4)', [id, c.startSec, c.endSec, c.text]);
  }
  async getTranscript(id) { return (await this.pool.query('SELECT start_sec AS "startSec", end_sec AS "endSec", text FROM transcript_chunks WHERE session_id=$1 ORDER BY start_sec,id', [id])).rows; }
  async getReport(id) { return (await this.pool.query('SELECT report,verification FROM reports WHERE session_id=$1', [id])).rows[0] || null; }
  async saveReport(id, report, verification = {}) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO reports(session_id,report,verification) VALUES($1,$2,$3) ON CONFLICT(session_id) DO UPDATE SET report=excluded.report,verification=excluded.verification,updated_at=now()', [id, report, verification]);
      await client.query('DELETE FROM topics WHERE session_id=$1', [id]);
      for (const [position, topic] of report.topics.entries()) await client.query('INSERT INTO topics(session_id,position,start_sec,end_sec,title) VALUES($1,$2,$3,$4,$5)', [id, position, topic.start, topic.end, topic.title]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async close() { await this.pool.end(); }
}

export function makeEvent(session, studentId, type, payload, now = Date.now()) {
  return { id: randomUUID(), session_id: session.id, student_id: studentId,
    type, transcript_ts_sec: Math.max(0, (now - new Date(session.started_at).getTime()) / 1000),
    created_at: new Date(now).toISOString(), payload };
}
