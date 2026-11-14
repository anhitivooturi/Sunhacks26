import QRCode from 'qrcode';
import { USE_MOCK } from './config.js';
import { mockReport } from '../mock/report.js';

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

export async function createSession() {
  if (USE_MOCK) {
    const code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
    const joinUrl = `${window.location.origin}/j/${code}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 1, width: 600 });
    return { id: 'demo', code, joinUrl, qrDataUrl };
  }
  return http('POST', '/sessions', {});
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
  if (USE_MOCK) return [];
  return http('GET', `/sessions/${id}/transcript`);
}
