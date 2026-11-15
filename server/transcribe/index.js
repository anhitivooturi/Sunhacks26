import { WebSocketServer, WebSocket } from 'ws';
import { AudioQueue } from './queue.js';
import { createAwsStream } from './aws.js';
import { createWhisperStream } from './whisper.js';

export async function registerTranscription(app, live, { env = process.env, createStream, now = Date.now } = {}) {
  createStream ||= env.TRANSCRIPTION_PROVIDER === 'whisper' ? createWhisperStream : createAwsStream;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16384, perMessageDeflate: false });
  const streams = new Map();
  const limit = Math.max(1, Math.min(10, Number(env.TRANSCRIBE_MAX_STREAMS) || 2));
  if (env.TRANSCRIBE_ENABLED !== 'true') app.log.info('AWS Transcribe disabled; browser transcription is available');
  const send = (ws, type, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, data })); };
  const reject = (socket, status, message) => socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  const seconds = session => Math.max(0, (now() - new Date(session.started_at).getTime()) / 1000);

  live.registerUpgrade('/ws/audio', async (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');
    const id = url.searchParams.get('sessionId');
    const mode = url.searchParams.get('mode') || 'transcribe';
    if (!/^[a-f\d-]{36}$/i.test(id || '') || !['transcribe', 'browser'].includes(mode)) return reject(socket, 400, 'Bad Request');
    const origin = request.headers.origin;
    if (origin && ![env.BASE_URL, ...(env.CORS_ORIGINS || 'http://localhost:5173').split(',')].filter(Boolean).map(v => v.replace(/\/$/, '')).includes(origin)) return reject(socket, 403, 'Forbidden');
    const session = await live.getSession(id);
    if (!session || session.ended_at) return reject(socket, 404, 'Not Found');
    if (streams.has(id)) return reject(socket, 409, 'Conflict');
    if (streams.size >= limit) return reject(socket, 503, 'Service Unavailable');
    // Reserve before upgrade: concurrent requests cannot start duplicate paid streams.
    streams.set(id, null);
    if (socket.destroyed) { streams.delete(id); return; }
    wss.handleUpgrade(request, socket, head, ws => {
      const queue = new AudioQueue(), abort = new AbortController();
      let provider, job = Promise.resolve(), stopping = false, firstAudioSec, bytes = 0, phraseStart;
      let lastFinal = -1, lastMessage = now();
      const finalized = new Set();
      const cleanup = () => { clearInterval(watch); queue.end(); abort.abort(); provider?.close(); if (streams.get(id)?.ws === ws) streams.delete(id); };
      const fail = (message, code = 'transcribe_unavailable') => {
        send(ws, 'error', { code, message, fallback: 'browser' });
        cleanup(); ws.close(1011, 'Transcription unavailable');
      };
      const watch = setInterval(() => {
        if (now() - lastMessage > 20000) { cleanup(); ws.close(1000, 'Audio idle'); }
        else if (seconds(session) > (Number(env.TRANSCRIBE_MAX_SESSION_SECONDS) || 3600)) fail('Recording limit reached. Start a new class.', 'recording_limit');
      }, 1000);
      watch.unref();
      async function publish(chunk) {
        if (chunk.final && finalized.has(chunk.id)) return;
        const clean = { text: chunk.text, final: chunk.final, startSec: chunk.startSec, endSec: chunk.endSec };
        if (clean.startSec < lastFinal) return;
        await live.publishTranscript(id, clean);
        if (chunk.final) { finalized.add(chunk.id); lastFinal = clean.endSec; }
        send(ws, 'transcript', { text: clean.text, final: clean.final, startSec: clean.startSec });
      }
      async function stop() {
        if (stopping) return job;
        stopping = true; queue.end();
        let timer;
        await Promise.race([job.catch(() => {}), new Promise(resolve => { timer = setTimeout(resolve, env.TRANSCRIPTION_PROVIDER === 'whisper' ? 11000 : 2500); })]);
        clearTimeout(timer); send(ws, 'stopped', {}); cleanup(); ws.close(1000, 'Stopped');
      }
      streams.set(id, { ws, stop });
      ws.on('error', () => cleanup());
      ws.on('close', cleanup);
      let browserQueue = Promise.resolve();
      ws.on('message', (raw, binary) => {
        if (stopping) return;
        lastMessage = now();
        try {
          if (binary) {
            if (mode !== 'transcribe' || !raw.length || raw.length % 2) throw new Error('Expected mono PCM16 audio');
            firstAudioSec ??= Math.max(0, seconds(session) - raw.length / 32000);
            bytes += raw.length;
            if (bytes / 32000 > seconds(session) - firstAudioSec + 5) throw new Error('Audio must be streamed in real time');
            queue.push(Buffer.from(raw)); return;
          }
          const message = JSON.parse(raw.toString());
          const data = message.data;
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid audio message');
          if (message.type === 'stop') { void browserQueue.then(stop).catch(() => fail('Could not finish transcription')); return; }
          if (message.type === 'ping') { send(ws, 'pong', {}); return; }
          if (mode !== 'browser' || Object.keys(data).some(key => !['text', 'final'].includes(key))) throw new Error('Clients must not send transcript timestamps');
          if (message.type === 'speech_start') { phraseStart = seconds(session); return; }
          if (message.type !== 'transcript' || typeof data.text !== 'string' || !data.text.trim() || data.text.length > 8000 || typeof data.final !== 'boolean') throw new Error('Invalid browser transcript');
          const startSec = phraseStart ?? seconds(session), endSec = Math.max(startSec, seconds(session));
          phraseStart = data.final ? undefined : startSec;
          const chunk = { text: data.text.trim(), final: data.final, startSec, endSec, id: `browser-${startSec}-${endSec}` };
          browserQueue = browserQueue.then(() => publish(chunk)).catch(() => fail('Could not save transcript'));
        } catch (error) { fail(error.message, 'invalid_audio'); }
      });
      if (mode === 'browser') send(ws, 'ready', { mode });
      else if (env.TRANSCRIPTION_PROVIDER !== 'whisper' && env.TRANSCRIBE_ENABLED !== 'true') fail('Cloud transcription is not enabled. Use browser transcription.', 'transcribe_disabled');
      else {
        job = (async () => {
          provider = await createStream({ env });
          if (abort.signal.aborted) { provider.close(); return; }
          send(ws, 'ready', { mode });
          for await (const result of provider.run(queue, abort.signal)) {
            if (abort.signal.aborted) return;
            if (result.heartbeat) { send(ws, 'progress', {}); continue; }
            const offset = firstAudioSec ?? seconds(session);
            await publish({ ...result, startSec: offset + result.startSec, endSec: offset + result.endSec });
          }
          if (!stopping && !abort.signal.aborted) { cleanup(); ws.close(1012, 'Reconnect transcription'); }
        })().catch(error => {
          if (!abort.signal.aborted) {
            app.log.warn({ name: error.name }, 'Cloud transcription stream failed');
            fail(/AWS_REGION|credentials/.test(error.message) ? error.message : 'Cloud transcription failed. Switching to browser transcription.');
          }
        });
      }
    });
  });
  live.stopTranscription = async id => { await streams.get(id)?.stop(); };
  app.addHook('preClose', async () => {
    await Promise.all([...streams.values()].filter(Boolean).map(s => s.stop()));
    for (const ws of wss.clients) ws.terminate();
    await new Promise(resolve => wss.close(resolve));
  });
}
