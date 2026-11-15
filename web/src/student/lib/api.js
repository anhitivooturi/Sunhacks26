// Data access with graceful fallback: real server first, fixtures if it is slow/down.
import fixtureReport from '@fixtures/report.json'
import fixtureTranscript from '@fixtures/transcript.json'
import { USE_MOCK } from './connection.js'
import { buildCannedNote } from './notesCanned.js'

async function getJSON(url, ms = 4000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms)
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); return await r.json() } finally { clearTimeout(t) }
}
export async function loadReport(sessionId) {
  if (!USE_MOCK) { try { return { data: await getJSON(`/sessions/${sessionId}/report`), source: 'live' } } catch { /* fall through */ } }
  return { data: fixtureReport, source: 'fixture' }
}
/** PROPOSED contract: GET /sessions/:id/review?studentId= -> { moments } (only the moments this student tapped Lost on). */
export async function loadReview(sessionId, studentId) {
  if (USE_MOCK) return null
  try { const d = await getJSON(`/sessions/${sessionId}/review?studentId=${encodeURIComponent(studentId)}`); return Array.isArray(d?.moments) ? d.moments : null } catch { return null }
}
export async function loadTranscript(sessionId) {
  if (!USE_MOCK) { try { const d = await getJSON(`/sessions/${sessionId}/transcript`); return d.chunks || d } catch { /* fall through */ } }
  return fixtureTranscript
}

/* ---- Atlas-backed personalization (/api, see server/) ---- */
async function send(method, url, body) {
  try { const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return r.ok ? await r.json() : null } catch { return null }
}
export const loadSettings = id => getJSON(`/api/student/${id}/settings`, 2500).catch(() => null)
export const saveSettings = (id, s) => send('PUT', `/api/student/${id}/settings`, s)
const q = sessionId => (sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '')
// Atlas collections: notes you generated and questions you asked, per class session. Every call fails soft (empty list / null).
export const listNotes = (id, sessionId) => getJSON(`/api/student/${id}/notes${q(sessionId)}`, 2500).catch(() => [])
export const listThreads = (id, sessionId) => getJSON(`/api/student/${id}/threads${q(sessionId)}`, 2500).catch(() => [])
export const saveThread = (id, t) => send('POST', `/api/student/${id}/threads`, t)
export async function generateNote({ studentId, sessionId, moment, format }) {
  // server/atlas generates the note and saves it (one document per student + session + moment + format).
  // The contract's PROPOSED POST /notes is the same handler, but /api/* is what the dev proxy and Caddy send to the Atlas service.
  const out = await send('POST', '/api/notes', { sessionId, momentId: moment.id, studentId, format, passage: moment.passage, moment })
  return out ? { ...out, saved: true } : { ...buildCannedNote(moment, format), saved: false } // offline fallback so the UI never dead-ends
}
