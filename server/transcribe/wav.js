export function readPcmWav(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Expected a PCM WAV file');
  let format, pcm;
  for (let at = 12; at + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(at + 4), begin = at + 8;
    if (begin + size > bytes.length) throw new Error('Truncated WAV file');
    const tag = bytes.toString('ascii', at, at + 4);
    if (tag === 'fmt ' && size >= 16) format = { codec: bytes.readUInt16LE(begin), channels: bytes.readUInt16LE(begin + 2), rate: bytes.readUInt32LE(begin + 4), bits: bytes.readUInt16LE(begin + 14) };
    if (tag === 'data') pcm = bytes.subarray(begin, begin + size);
    at = begin + size + (size % 2);
  }
  if (!format || format.codec !== 1 || format.channels !== 1 || format.rate !== 16000 || format.bits !== 16 || !pcm?.length || pcm.length % 2) throw new Error('WAV must be 16 kHz, mono, PCM16 little-endian');
  return pcm;
}
