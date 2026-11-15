"""Private PCM16 transcription worker for an EC2 instance; no raw audio is stored."""
import hmac
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
from faster_whisper import WhisperModel

TOKEN = os.environ["WHISPER_TOKEN"]
MODEL_NAME = os.environ.get("WHISPER_MODEL", "tiny.en")
model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8", cpu_threads=2,
                     download_root="/opt/whisper/models")
busy = threading.BoundedSemaphore(1)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log audio, transcript text or bearer tokens.

    def reply(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def allowed(self):
        return hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + TOKEN)

    def do_GET(self):
        if self.path != "/health" or not self.allowed():
            return self.reply(403, {"error": "forbidden"})
        self.reply(200, {"ok": True, "model": MODEL_NAME})

    def do_POST(self):
        if self.path != "/transcribe" or not self.allowed():
            return self.reply(403, {"error": "forbidden"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.reply(400, {"error": "invalid_length"})
        if not 0 < size <= 320000 or size % 2:
            return self.reply(400, {"error": "expected_pcm16_16khz_mono"})
        if not busy.acquire(timeout=1):
            return self.reply(503, {"error": "busy"})
        try:
            self.connection.settimeout(10)
            audio = self.rfile.read(size)
            if len(audio) != size:
                return self.reply(400, {"error": "truncated_audio"})
            samples = np.frombuffer(audio, dtype="<i2").astype(np.float32) / 32768.0
            segments, _ = model.transcribe(samples, language="en", beam_size=1,
                                            vad_filter=True, condition_on_previous_text=False)
            self.reply(200, {"segments": [{"start": s.start, "end": s.end, "text": s.text}
                                           for s in segments]})
        except Exception:
            self.reply(503, {"error": "transcription_failed"})
        finally:
            busy.release()


ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
