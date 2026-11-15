// Integrate each input sample over output bins. State survives 128-frame worklet calls.
export class Pcm16Resampler {
  constructor(inputRate, emit, chunkSamples = 1600) {
    if (inputRate < 16000) throw new Error('Microphone sample rate must be at least 16 kHz');
    this.ratio = inputRate / 16000; this.emit = emit; this.chunkSamples = chunkSamples;
    this.sum = 0; this.weight = 0; this.buffer = new ArrayBuffer(chunkSamples * 2); this.view = new DataView(this.buffer); this.count = 0;
  }
  push(channels) {
    if (!channels?.length || !channels[0]?.length) return;
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] || 0;
      sample /= channels.length;
      let remaining = 1;
      while (remaining > 1e-8) {
        const take = Math.min(remaining, this.ratio - this.weight);
        this.sum += sample * take; this.weight += take; remaining -= take;
        if (this.weight >= this.ratio - 1e-8) {
          const value = Math.max(-1, Math.min(1, this.sum / this.ratio));
          this.view.setInt16(this.count++ * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
          this.sum = 0; this.weight = 0;
          if (this.count === this.chunkSamples) this.flush();
        }
      }
    }
  }
  flush() {
    if (!this.count) return;
    this.emit(this.buffer.slice(0, this.count * 2));
    this.buffer = new ArrayBuffer(this.chunkSamples * 2); this.view = new DataView(this.buffer); this.count = 0;
  }
}
