import { USE_MOCK } from './config.js';
import { createMockFeed } from '../mock/hostFeed.js';

// Host feed: { on(type, cb) -> unsubscribe, send(type, data), close() }.
// Emits a synthetic 'status' event: 'connecting' | 'open' | 'reconnecting' | 'mock'.
export function createHostFeed(code) {
  if (USE_MOCK) return createMockFeed();
  return createSocketFeed(code, 'host');
}

function createSocketFeed(code, role) {
  const listeners = {};
  const outbox = [];
  let ws;
  let attempt = 0;
  let closed = false;
  let retryTimer;

  const emit = (type, data) => (listeners[type] || []).forEach((cb) => cb(data));

  const connect = () => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${window.location.host}/ws?code=${encodeURIComponent(code)}&role=${role}`);
    emit('status', attempt === 0 ? 'connecting' : 'reconnecting');

    ws.onopen = () => {
      attempt = 0;
      emit('status', 'open');
      while (outbox.length) ws.send(outbox.shift());
    };
    ws.onmessage = (ev) => {
      try {
        const { type, data } = JSON.parse(ev.data);
        emit(type, data);
      } catch {
        /* ignore malformed messages */
      }
    };
    ws.onclose = () => {
      if (closed) return;
      emit('status', 'reconnecting');
      const delay = Math.min(10000, 500 * 2 ** attempt++); // backoff: 0.5s, 1s, 2s ... 10s
      retryTimer = setTimeout(connect, delay);
    };
    ws.onerror = () => ws.close();
  };
  connect();

  return {
    on(type, cb) {
      (listeners[type] ||= []).push(cb);
      return () => (listeners[type] = listeners[type].filter((f) => f !== cb));
    },
    send(type, data = {}) {
      const msg = JSON.stringify({ type, data });
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(msg);
      else outbox.push(msg); // flushed on reconnect, so clicks on bad Wi-Fi are not lost
    },
    close() {
      closed = true;
      clearTimeout(retryTimer);
      ws && ws.close();
    },
  };
}
