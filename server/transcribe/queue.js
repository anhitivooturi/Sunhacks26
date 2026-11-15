// Five seconds of PCM at 16 kHz. Slow consumers fail rather than accumulating audio.
export class AudioQueue {
  constructor(limit = 160000) { this.limit = limit; this.bytes = 0; this.items = []; this.waiter = null; this.ended = false; }
  push(bytes) {
    if (this.ended) return;
    if (this.bytes + bytes.length > this.limit) throw new Error('Audio backlog exceeded five seconds');
    this.items.push(bytes); this.bytes += bytes.length; this.waiter?.(); this.waiter = null;
  }
  end() { this.ended = true; this.waiter?.(); this.waiter = null; }
  async *[Symbol.asyncIterator]() {
    while (!this.ended || this.items.length) {
      if (!this.items.length) { await new Promise(resolve => { this.waiter = resolve; }); continue; }
      const chunk = this.items.shift(); this.bytes -= chunk.length; yield chunk;
    }
  }
}
