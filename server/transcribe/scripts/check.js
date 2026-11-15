import './env.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createAwsStream } from '../aws.js';
import { createWhisperStream } from '../whisper.js';
let failed = false;
for (const folder of ['../', '../../ai/']) {
  const cwd = fileURLToPath(new URL(folder, import.meta.url));
  const tests = readdirSync(new URL(`${folder}test/`, import.meta.url)).filter(name => name.endsWith('.test.js')).map(name => `test/${name}`);
  const result = spawnSync(process.execPath, ['--test', ...tests], { cwd, stdio: 'inherit', env: { ...process.env, AI_OFFLINE: '1' } });
  if (result.status !== 0) failed = true;
}
if (process.argv.includes('--live')) {
  let provider;
  try {
    if (process.env.TRANSCRIPTION_PROVIDER !== 'whisper' && process.env.TRANSCRIBE_ENABLED !== 'true') console.log('Cloud transcription: DISABLED (no AWS request made)');
    else {
    provider = process.env.TRANSCRIPTION_PROVIDER === 'whisper' ? await createWhisperStream() : await createAwsStream();
    const audio = (async function* () { for (let i = 0; i < 10; i++) { yield Buffer.alloc(3200); await delay(100); } })();
    for await (const _ of provider.run(audio, AbortSignal.timeout(15000))) { /* access probe, no speech expected */ }
    console.log('Cloud transcription access: PASS (one-second silence probe)');
    }
  } catch (error) { failed = true; console.error(`AWS streaming access: FAIL: ${error.name}: ${error.message}`); }
  finally { provider?.close(); }
  const result = spawnSync(process.execPath, ['scripts/fixtures.js', '--live'], { cwd: fileURLToPath(new URL('../../ai/', import.meta.url)), stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
