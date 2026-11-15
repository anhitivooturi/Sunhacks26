import { randomUUID } from 'node:crypto';
import { readFixture, normalizeChunks, normalizeEvents } from '../src/fixtures.js';
import { verifyMoment } from '../src/verification.js';

export async function seedStore(store) {
  const existing = await store.findSession('DEMX');
  if (existing) return existing;
  const [report, rawChunks, rawEvents] = await Promise.all(['report', 'transcript', 'events'].map(readFixture));
  const chunks = normalizeChunks(rawChunks);
  const events = normalizeEvents(rawEvents);
  const durationSec = Math.max(report.durationSec, chunks.at(-1)?.endSec || 0);
  const started = Date.now() - durationSec * 1000;
  const session = await store.createSession({ id: randomUUID(), code: 'DEMX', started_at: new Date(started).toISOString(), ended_at: new Date(started + durationSec * 1000).toISOString() });
  for (const chunk of chunks) await store.addTranscript(session.id, chunk);
  const seededEvents = [];
  for (const event of events) {
    const e = { ...event, id: randomUUID(), session_id: session.id, created_at: new Date(started + Number(event.transcript_ts_sec) * 1000).toISOString() };
    await store.appendEvent(e); seededEvents.push(e);
  }
  report.sessionId = session.id;
  await store.saveReport(session.id, report, Object.fromEntries(report.moments.map(m => [m.id, verifyMoment(m, seededEvents)])));
  return session;
}
