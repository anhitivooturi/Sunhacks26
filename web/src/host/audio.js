import workletUrl from './pcm-worklet.js?worker&url';
import { USE_MOCK, CLOUD_TRANSCRIPTION_ENABLED } from '../lib/config.js';

export async function checkMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export async function startAudio({ sessionId, mode = 'browser', onStatus = () => {} }) {
  if (USE_MOCK) return async () => {};
  if (!CLOUD_TRANSCRIPTION_ENABLED) mode = 'browser';
  let stopped = false, switching = false, activeMode = mode, socket, stream, context, processor, source, silent;
  let recognition, restartTimer, heartbeat, watchdog, lastResult = Date.now(), reconnects = 0;
  let textOutbox = [], draining = false;
  const status = (state, message) => { if (!stopped) onStatus({ state, message }); };
  const send = (type, data = {}) => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, data })); };

  async function closeInput() {
    clearTimeout(restartTimer); clearInterval(watchdog);
    if (recognition) {
      const old = recognition; recognition = null; old.onerror = null;
      await new Promise(resolve => {
        const timer = setTimeout(() => { old.abort(); resolve(); }, 700);
        old.onend = () => { clearTimeout(timer); resolve(); };
        try { old.stop(); } catch { clearTimeout(timer); old.abort(); resolve(); }
      });
    }
    if (processor) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 100);
        processor.port.onmessage = event => {
          if (event.data === 'flushed') { clearTimeout(timer); resolve(); }
          else if (event.data instanceof ArrayBuffer && socket?.readyState === WebSocket.OPEN) socket.send(event.data);
        };
        processor.port.postMessage('flush');
      });
      processor.disconnect(); processor.port.close(); processor = null;
    }
    source?.disconnect(); silent?.disconnect(); stream?.getTracks().forEach(track => track.stop());
    stream = null;
    if (context && context.state !== 'closed') await context.close();
    context = null;
  }
  async function closeSocket() {
    clearInterval(heartbeat);
    const old = socket; socket = null;
    if (!old || old.readyState > WebSocket.OPEN) return;
    draining = true;
    await new Promise(resolve => {
      const timer = setTimeout(() => { old.close(); resolve(); }, 12000);
      const done = () => { clearTimeout(timer); old.close(); resolve(); };
      old.addEventListener('close', done, { once: true });
      old.addEventListener('message', event => { try { if (JSON.parse(event.data).type === 'stopped') done(); } catch { /* ignore */ } });
      if (old.readyState === WebSocket.OPEN) old.send(JSON.stringify({ type: 'stop', data: {} })); else old.close();
    });
    draining = false;
  }
  async function openSocket(nextMode) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/audio?sessionId=${encodeURIComponent(sessionId)}&mode=${nextMode}`);
    socket = ws;
    await new Promise((resolve, reject) => {
      let ready = false;
      const timer = setTimeout(() => { ws.close(); reject(new Error('Transcription connection timed out')); }, 10000);
      ws.onmessage = event => {
        let message; try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'ready') { ready = true; clearTimeout(timer); resolve(); }
        if (message.type === 'transcript' || message.type === 'progress') lastResult = Date.now();
        if (message.type === 'error') {
          if (!ready) { clearTimeout(timer); reject(new Error(message.data.message)); }
          else if (!stopped && !switching) void fallback(message.data.message);
        }
      };
      ws.onerror = () => { if (!ready) { clearTimeout(timer); reject(new Error('Could not connect to transcription')); } };
      ws.onclose = event => {
        clearTimeout(timer);
        if (!ready) { reject(new Error('Transcription connection closed')); return; }
        if (stopped || switching || draining || ws !== socket) return;
        if (nextMode === 'transcribe' && event.code === 1012 && reconnects++ < 2) {
          status('connecting', 'Reconnecting microphone transcription…');
          void restartAws();
        } else if (nextMode === 'transcribe') void fallback('Audio connection interrupted.');
        else status('error', 'Transcript connection lost. Pause, then Resume to reconnect.');
      };
    });
    heartbeat = setInterval(() => send('ping'), 5000);
    return ws;
  }
  async function startAws() {
    await openSocket('transcribe');
    if (stopped) return;
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
    await context.audioWorklet.addModule(workletUrl);
    await context.resume();
    source = context.createMediaStreamSource(stream);
    processor = new AudioWorkletNode(context, 'lecture-pcm');
    silent = context.createGain(); silent.gain.value = 0;
    processor.port.onmessage = event => {
      if (!(event.data instanceof ArrayBuffer) || socket?.readyState !== WebSocket.OPEN) return;
      if (socket.bufferedAmount > 160000) { void fallback('Audio upload stalled.'); return; }
      socket.send(event.data);
    };
    source.connect(processor); processor.connect(silent); silent.connect(context.destination);
    lastResult = Date.now();
    watchdog = setInterval(() => { if (Date.now() - lastResult > 10000) void fallback('Cloud transcription stalled for 10 seconds.'); }, 500);
    status('listening', 'Listening with cloud transcription');
  }
  async function startBrowser() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) throw new Error('Browser transcription is unavailable. Use Chrome or Edge, or configure AWS Transcribe.');
    await openSocket('browser');
    if (stopped) return;
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; recognition.continuous = true; recognition.interimResults = true;
    recognition.onspeechstart = () => send('speech_start');
    recognition.onresult = event => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.trim();
        if (text) textOutbox.push({ text, final: event.results[i].isFinal });
      }
      if (textOutbox.length > 20) textOutbox = textOutbox.slice(-20);
      if (socket?.readyState === WebSocket.OPEN) for (const data of textOutbox.splice(0)) send('transcript', data);
    };
    recognition.onerror = event => {
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) {
        recognition.onend = null;
        status('error', 'Microphone access failed. Allow microphone access, then Pause and Resume.');
      } else status('connecting', 'Browser transcription interrupted; reconnecting…');
    };
    recognition.onend = () => {
      if (!stopped && activeMode === 'browser' && recognition) restartTimer = setTimeout(() => { try { recognition?.start(); } catch { status('error', 'Could not restart transcription. Pause, then Resume.'); } }, 500);
    };
    recognition.onstart = () => status('listening', 'Listening with browser transcription');
    recognition.start();
  }
  async function fallback(reason) {
    if (stopped || switching) return;
    switching = true; status('connecting', `${reason} Switching to browser transcription…`);
    try {
      await closeInput(); await closeSocket(); activeMode = 'browser';
      if (!stopped) await startBrowser();
    } catch (error) { status('error', error.message); }
    finally { switching = false; }
  }
  async function restartAws() {
    if (stopped || switching) return;
    switching = true;
    try { await closeInput(); await closeSocket(); if (!stopped) await startAws(); }
    catch { switching = false; await fallback('Cloud transcription reconnection failed.'); }
    finally { switching = false; }
  }
  status('connecting', 'Connecting microphone transcription…');
  try { if (mode === 'browser') await startBrowser(); else await startAws(); }
  catch (error) { if (mode === 'browser') status('error', error.message); else await fallback(error.message); }
  return async () => { if (stopped) return; stopped = true; await closeInput(); await closeSocket(); };
}
