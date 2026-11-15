import { Pcm16Resampler } from './pcm.js';
class LecturePcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.resampler = new Pcm16Resampler(sampleRate, bytes => this.port.postMessage(bytes, [bytes]));
    this.port.onmessage = event => { if (event.data === 'flush') { this.resampler.flush(); this.port.postMessage('flushed'); } };
  }
  process(inputs) { this.resampler.push(inputs[0]); return true; }
}
registerProcessor('lecture-pcm', LecturePcm);
