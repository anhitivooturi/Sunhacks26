// Gemini Live transcription provider (free tier). Same contract as aws.js and whisper.js:
//   createGeminiStream({ env }) -> { run(audio, signal) yields { id, text, final, startSec, endSec } | { heartbeat }, close() }
// Times are seconds from the first audio byte; index.js adds the session offset.
// Gemini Live sessions last at most 10 minutes, so this opens a fresh upstream every 9 minutes and
// hands over without dropping audio. Needs GEMINI_API_KEY; GEMINI_TRANSCRIBE_MODEL is optional.
const URL_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const ROTATE_MS = 9 * 60 * 1000;
const LAG_SEC = 1.5; // the first partial of an utterance arrives roughly this long after the words start
const BYTES_PER_SEC = 32000; // 16 kHz, 16-bit mono

export async function createGeminiStream({ env = process.env, WebSocketImpl = globalThis.WebSocket } = {}) {
  if (!env.GEMINI_API_KEY) throw new Error('Set GEMINI_API_KEY on the server for Gemini transcription');
  const model = env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe-live';
  const sockets = new Set();

  return {
    async *run(audio, signal) {
      const out = []; // results waiting to be yielded
      let wake = null;
      let failure = null;
      const push = (item) => { out.push(item); wake?.(); wake = null; };
      const fail = (error) => { failure ||= error; wake?.(); wake = null; };

      let sentBytes = 0; // audio clock
      const audioSec = () => sentBytes / BYTES_PER_SEC;
      let turn = null; // { id, startSec } for the utterance in progress
      let index = 0, lastEnd = 0, retries = 0;
      let current = null; // socket audio goes to
      const buffered = []; // audio while (re)connecting, ~10 s max
      let rotateTimer;

      const onText = (text, final) => {
        text = text?.trim().replace(/([.?!,])(?=[A-Za-z])/g, '$1 ');
        if (!turn && text) turn = { id: `gemini-${index++}`, startSec: Math.max(lastEnd, audioSec() - LAG_SEC) };
        if (!turn) return;
        if (!final) { push({ id: turn.id, text, final: false, startSec: turn.startSec, endSec: audioSec() }); return; }
        const endSec = Math.max(turn.startSec, audioSec());
        if (text) push({ id: turn.id, text, final: true, startSec: turn.startSec, endSec });
        lastEnd = endSec;
        turn = null;
      };

      const sendAudio = (ws, bytes) => ws.send(JSON.stringify({ realtimeInput: { audio: { data: Buffer.from(bytes).toString('base64'), mimeType: 'audio/pcm;rate=16000' } } }));
      const endStream = (ws) => { if (ws.readyState === 1) ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })); };

      const open = () => {
        if (signal.aborted) return;
        const ws = new WebSocketImpl(`${URL_BASE}?key=${encodeURIComponent(env.GEMINI_API_KEY)}`);
        sockets.add(ws);
        ws.onopen = () => ws.send(JSON.stringify({ setup: { model: `models/${model}`, generationConfig: { responseModalities: ['TEXT'] }, inputAudioTranscription: { languageCodes: ['en-US'] } } }));
        ws.onmessage = async (event) => {
          let msg;
          try { msg = JSON.parse(typeof event.data === 'string' ? event.data : await new Response(event.data).text()); } catch { return; }
          if (msg.setupComplete) {
            retries = 0;
            const old = current;
            current = ws;
            for (const bytes of buffered.splice(0)) sendAudio(ws, bytes);
            if (old) { endStream(old); setTimeout(() => old.close(), 4000); } // let it finish its last sentence
            clearTimeout(rotateTimer);
            rotateTimer = setTimeout(open, ROTATE_MS);
            return;
          }
          const c = msg.serverContent;
          if (c?.interimInputTranscription) onText(c.interimInputTranscription.text, false);
          if (c?.inputTranscription) onText(c.inputTranscription.text, true);
          if (msg.goAway) open(); // Gemini warns before it ends a session
        };
        ws.onerror = () => {};
        ws.onclose = (event) => {
          sockets.delete(ws);
          if (signal.aborted || (current && current !== ws)) return; // rotated out: expected
          current = null;
          if (event.code === 1008 || event.code === 1007 || retries >= 4) return fail(new Error(`Gemini Live closed (${event.code} ${event.reason || ''})`.trim()));
          setTimeout(open, 500 * 2 ** retries++);
        };
      };

      open();
      const heartbeat = setInterval(() => push({ heartbeat: true }), 3000); // keeps the client watchdog calm in silence
      signal.addEventListener('abort', () => { wake?.(); wake = null; }, { once: true });

      // Feed audio in the background while results are yielded below.
      let audioDone = false;
      (async () => {
        for await (const bytes of audio) {
          if (signal.aborted) break;
          if (current?.readyState === 1) sendAudio(current, bytes);
          else if (buffered.length < 100) buffered.push(bytes);
          sentBytes += bytes.length;
        }
        if (current) endStream(current);
        await new Promise((r) => setTimeout(r, 2000)); // final sentence
        audioDone = true;
        wake?.(); wake = null;
      })().catch(fail);

      try {
        while (!signal.aborted) {
          if (failure) throw failure;
          if (out.length) { yield out.shift(); continue; }
          if (audioDone) break;
          await new Promise((r) => { wake = r; });
        }
      } finally {
        clearInterval(heartbeat);
        clearTimeout(rotateTimer);
        for (const ws of sockets) ws.close();
      }
    },
    close() { for (const ws of sockets) ws.close(); },
  };
}
