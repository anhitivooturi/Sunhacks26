// Person B plugs live audio in here. The host screens only call these three functions.
//   checkMic()                       -> Promise<boolean>   (asks for mic permission once)
//   startAudio({ sessionId, mode })  -> Promise<stopFn>    mode: 'transcribe' | 'browser'
// Replace startAudio with the real AudioWorklet → /ws/audio stream (transcribe) or Web Speech path (browser).

export async function checkMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export async function startAudio({ sessionId, mode }) {
  console.info(`[audio stub] would start ${mode} transcription for session ${sessionId}`);
  return () => console.info('[audio stub] stopped');
}
