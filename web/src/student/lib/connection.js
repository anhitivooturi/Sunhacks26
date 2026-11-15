// One interface, two implementations: real WebSocket (with backoff reconnect) and a fixtures-driven mock.
// Flip with VITE_USE_MOCK=0 (real) or ?mock=1 / ?mock=0 in the URL.
import report from '@fixtures/report.json'
import transcript from '@fixtures/transcript.json'
import events from '@fixtures/events.json'

const qs = new URLSearchParams(location.search)
// Same rule as the shared web/src/lib/config.js: VITE_USE_MOCK=false (or ?mock=0) talks to the real server.
export const USE_MOCK = qs.has('mock') ? qs.get('mock') !== '0' : import.meta.env.VITE_USE_MOCK !== 'false'

/** @returns {{send(msg):void, close():void}} */
export function connect({ code, studentId, onMessage, onStatus }) {
  return USE_MOCK ? mockConnection({ code, studentId, onMessage, onStatus }) : realConnection({ code, studentId, onMessage, onStatus })
}

/* ---------------- real ---------------- */
// Contract envelope: every message is { type, data: {...} }. The app uses flat objects internally.
const wire = ({ type, ...data }) => JSON.stringify({ type, data })

function realConnection({ code, studentId, onMessage, onStatus }) {
  let ws, closed = false, attempt = 0, timer, hb // (hb unused: no app-level ping in the contract)
  const queue = [] // taps made while offline (max 4, <10s old) so a bad-Wi-Fi blip does not eat them
  const open = () => {
    onStatus(attempt ? 'reconnecting' : 'connecting')
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/ws?code=${encodeURIComponent(code)}&role=student&studentId=${encodeURIComponent(studentId)}`)
    ws.onopen = () => {
      attempt = 0; onStatus('live')
      const now = Date.now()
      while (queue.length) { const q = queue.shift(); if (now - q.t < 10000) ws.send(wire(q.msg)) }
    }
    ws.onmessage = e => { try { const { type, data } = JSON.parse(e.data); onMessage({ type, ...(data || {}) }) } catch { /* ignore garbage */ } } // contract: { type, data }
    ws.onclose = ev => {
      clearInterval(hb)
      if (closed) return
      if (ev.code === 4404 || ev.code === 1008) { onStatus('bad_code'); return } // unknown code: stop retrying
      onStatus('reconnecting')
      const delay = Math.min(8000, 500 * 2 ** attempt++) + Math.random() * 400
      timer = setTimeout(open, delay)
    }
    ws.onerror = () => ws.close()
  }
  open()
  const onOnline = () => { if (ws.readyState !== 1) { clearTimeout(timer); attempt = 0; open() } }
  window.addEventListener('online', onOnline)
  return {
    send(msg) {
      if (ws && ws.readyState === 1) ws.send(wire(msg))
      else if (msg.type === 'react' || msg.type === 'quiz_answer') { queue.push({ msg, t: Date.now() }); if (queue.length > 4) queue.shift() }
    },
    close() { closed = true; clearTimeout(timer); clearInterval(hb); window.removeEventListener('online', onOnline); ws && ws.close() },
  }
}

/* ---------------- mock (replays fixtures) ---------------- */
function mockConnection({ studentId, onMessage, onStatus }) {
  const timers = []
  const later = (ms, fn) => timers.push(setTimeout(fn, ms))
  const every = (ms, fn) => timers.push(setInterval(fn, ms))
  const speed = 6 // 1 real second = 6 lecture seconds
  let qlist = events.filter(e => e.type === 'question').map(e => ({
    id: e.payload.questionId, text: e.payload.text, upvotes: events.filter(u => u.type === 'upvote' && u.payload.questionId === e.payload.questionId).length,
    answered: events.some(a => a.type === 'mark_answered' && a.payload.questionId === e.payload.questionId),
  })).sort((a, b) => b.upvotes - a.upvotes)
  const pushQs = () => onMessage({ type: 'questions', list: [...qlist].sort((a, b) => b.upvotes - a.upvotes) })
  let t0 = 0, hold = 0 // hold: keep a simulated reaction visible instead of letting the periodic fake meter overwrite it

  later(450, () => {
    onStatus('live')
    onMessage({ type: 'welcome', studentId, sessionId: 'demo-session' })
    pushQs()
    let i = 0
    every(2400, () => { // replay transcript lines, partial then final
      const c = transcript[i % transcript.length]; i++; t0 = c.startSec
      onMessage({ type: 'transcript', text: c.text.slice(0, Math.ceil(c.text.length * 0.55)), final: false, startSec: c.startSec })
      later(900, () => onMessage({ type: 'transcript', text: c.text, final: true, startSec: c.startSec }))
    })
    every(2000, () => { // meter (students normally don't get this; harmless)
      if (Date.now() < hold) return
      const sec = t0; const lost = events.filter(e => e.type === 'lost' && e.transcriptTsSec <= sec && e.transcriptTsSec > sec - 30)
      const n = new Set(lost.map(e => e.studentId)).size
      onMessage({ type: 'meter', score: n / 20, lostCount: n, active: 20 })
    })
    later(60000, () => onMessage({ type: 'push_fix', moment: report.moments[0] })) // auto demo push
  })
  window.__pulsePush = (i = 0) => onMessage({ type: 'push_fix', moment: report.moments[i] }) // dev: window.__pulsePush(1)

  return {
    send(msg) {
      if (msg.type === 'react' && msg.kind === 'lost') later(650, () => { hold = Date.now() + 5200; const n = 9 + Math.floor(Math.random() * 7); onMessage({ type: 'meter', score: n / 20, lostCount: n, active: 20 }) })
      if (msg.type === 'question') { qlist.push({ id: 'm' + Date.now(), text: msg.text, upvotes: 1, answered: false }); pushQs() }
      if (msg.type === 'upvote') { qlist = qlist.map(q => (q.id === msg.questionId ? { ...q, upvotes: q.upvotes + 1 } : q)); pushQs() }
    },
    close() { timers.forEach(t => { clearTimeout(t); clearInterval(t) }); delete window.__pulsePush },
  }
}
