// The EC2 worker performs inference; this adapter keeps the existing audio contract.
export async function createWhisperStream({ env = process.env, fetch: request = globalThis.fetch } = {}) {
  const base = new URL(env.WHISPER_URL || '');
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('WHISPER_URL must use HTTPS');
  if (!env.WHISPER_TOKEN) throw new Error('Set WHISPER_TOKEN for the EC2 transcription worker');
  return {
    async *run(audio, signal) {
      let pending = Buffer.alloc(0), cursor = 0, index = 0, lastEnd = 0;
      const seconds = 4, blockBytes = seconds * 32000;
      async function* transcribe(bytes) {
        const offset = cursor / 32000;
        const response = await request(new URL('/transcribe', base), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${env.WHISPER_TOKEN}` }, body: bytes,
          signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
        if (!response.ok) throw new Error(`EC2 transcription worker HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.segments)) throw new Error('Invalid EC2 transcription response');
        if (!data.segments.length) yield { heartbeat: true };
        for (const segment of data.segments) {
          if (typeof segment.text !== 'string' || !Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.start < 0 || segment.end < segment.start || segment.end > bytes.length / 32000 + 0.1) throw new Error('Invalid EC2 transcript segment');
          if (!segment.text.trim() || offset + segment.end <= lastEnd) continue;
          const startSec = Math.max(lastEnd, offset + segment.start), endSec = offset + segment.end;
          yield { id: `ec2-${index++}`, text: segment.text.trim(), final: true, startSec, endSec };
          lastEnd = endSec;
        }
        cursor += bytes.length;
      }
      for await (const bytes of audio) {
        pending = Buffer.concat([pending, bytes]);
        while (pending.length >= blockBytes) { const block = pending.subarray(0, blockBytes); pending = pending.subarray(blockBytes); yield* transcribe(block); }
      }
      if (pending.length >= 3200) yield* transcribe(pending);
    },
    close() {},
  };
}
