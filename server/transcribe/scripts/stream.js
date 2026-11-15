import './env.js';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createAwsStream } from '../aws.js';
import { readPcmWav } from '../wav.js';
import { createWhisperStream } from '../whisper.js';
const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file'), micIndex = args.indexOf('--mic');
if (fileIndex < 0 && micIndex < 0) { console.error('Usage: npm run file -- --file recording.wav OR npm run mic -- "Microphone device name" (FFmpeg required)'); process.exit(1); }
let mic, provider;
const abort = new AbortController();
process.once('SIGINT', () => { abort.abort(); mic?.kill(); });
try {
  if (process.env.TRANSCRIPTION_PROVIDER === 'whisper') provider = await createWhisperStream();
  else if (process.env.TRANSCRIBE_ENABLED === 'true') provider = await createAwsStream();
  else throw new Error('AWS Transcribe is disabled. Configure the EC2 Whisper worker or use browser transcription.');
  let source;
  if (fileIndex >= 0) {
    const path = args[fileIndex + 1];
    if (!path) throw new Error('Supply --file path.wav (16 kHz mono PCM16)');
    const bytes = await readFile(path);
    const pcm = path.endsWith('.pcm') ? bytes : readPcmWav(bytes);
    source = (async function* () { for (let at = 0; at < pcm.length; at += 3200) yield pcm.subarray(at, at + 3200); })();
  } else {
    const device = args[micIndex + 1] || (process.platform === 'darwin' ? ':0' : 'default');
    if (process.platform === 'win32' && device === 'default') throw new Error('Pass the Windows microphone device name. List devices: ffmpeg -list_devices true -f dshow -i dummy');
    const input = process.platform === 'win32' ? ['-f', 'dshow', '-i', `audio=${device}`] : process.platform === 'darwin' ? ['-f', 'avfoundation', '-i', device] : ['-f', 'alsa', '-i', device];
    mic = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...input, '-ac', '1', '-ar', '16000', '-acodec', 'pcm_s16le', '-f', 's16le', 'pipe:1'], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
    mic.on('error', () => { console.error('FFmpeg is required for standalone microphone capture.'); abort.abort(); });
    source = mic.stdout;
  }
  const audio = (async function* () {
    let buffered = Buffer.alloc(0), sent = 0; const begin = performance.now();
    for await (const bytes of source) {
      buffered = Buffer.concat([buffered, bytes]);
      while (buffered.length >= 3200) {
        await delay(Math.max(0, begin + sent / 32 - performance.now()), undefined, { signal: abort.signal });
        yield buffered.subarray(0, 3200); buffered = buffered.subarray(3200); sent += 3200;
      }
    }
    if (buffered.length) yield buffered;
  })();
  for await (const result of provider.run(audio, abort.signal)) console.log(JSON.stringify(result));
} catch (error) { if (!abort.signal.aborted) { console.error(`${error.name}: ${error.message}`); process.exitCode = 1; } }
finally { provider?.close(); mic?.kill(); }
