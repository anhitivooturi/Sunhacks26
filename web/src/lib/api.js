import QRCode from 'qrcode';
import { USE_MOCK } from './config.js';
import { mockReport } from '../mock/report.js';
import fixtureTranscript from '@fixtures/transcript.json';
import fixtureEvents from '@fixtures/events.json';
import { createJoinUrl } from './join-url.js';

const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no O, I, L

async function http(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status})`);
  return res.json();
}

// meta = { course, section, title } typed on the start screen (PROPOSED: POST /sessions body).
export async function createSession(meta = {}) {
  if (USE_MOCK) {
    const code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
    const joinUrl = createJoinUrl(code, window.location.origin);
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 1, width: 600 });
    return { id: 'demo', code, joinUrl, qrDataUrl, ...meta, startedAt: new Date().toISOString() };
  }
  const s = await http('POST', '/sessions', meta);
  // The URL on screen, the clipboard and the QR all share this one value.
  // A public base override also supports a local frontend using the live API.
  const joinUrl = createJoinUrl(s.code, import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin);
  const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 4, width: 600 });
  return { ...meta, startedAt: new Date().toISOString(), ...s, joinUrl, qrDataUrl };
}

export async function endSession(id) {
  if (USE_MOCK) return { ok: true };
  return http('POST', `/sessions/${id}/end`, {});
}

// The report can take a few seconds to generate. Retry while the server says it isn't ready.
export async function getReport(id, { retries = 8 } = {}) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 600));
    return mockReport;
  }
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await http('GET', `/sessions/${id}/report`);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

export async function getTranscript(id) {
  if (USE_MOCK) return fixtureTranscript;
  try {
    const d = await http('GET', `/sessions/${id}/transcript`);
    return d.chunks || d;
  } catch {
    return [];
  }
}

// Every Lost tap and question with its lecture time, for the after-class transcript review.
// PROPOSED: GET /sessions/:id/activity -> [{ atSec, kind: 'lost' | 'question', text? }]
export async function getActivity(id) {
  if (USE_MOCK) {
    return fixtureEvents
      .filter((e) => e.type === 'lost' || e.type === 'question')
      .map((e) => ({ atSec: e.transcriptTsSec, kind: e.type, text: e.payload?.text }));
  }
  try {
    return await http('GET', `/sessions/${id}/activity`);
  } catch {
    return [];
  }
}
