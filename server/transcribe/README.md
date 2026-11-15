# Lecture transcription (Person B)

The live server registers `/ws/audio?sessionId=...&mode=transcribe|browser`. Browser audio is mono, 16 kHz, little-endian PCM16 in approximately 100 ms binary frames. Text fallback sends `{type:"speech_start",data:{}}` and `{type:"transcript",data:{text,final}}`, never timestamps. The server converts stream times to seconds since the session started, broadcasts partial/final results, and saves only final chunks. Stop drains pending results before the end-of-class report runs.

The free default is browser speech recognition. Supported browsers require microphone permission and may require internet access. The teacher sees listening/reconnect/error status. Cloud errors or a ten-second stall switch to browser recognition; Pause/Resume stops and restarts the microphone. Mock mode opens no microphone or transcription socket.

```powershell
npm ci
npm test                  # offline unit/integration tests
npm run check             # transcription + fallback + AI tests, no external API calls
npm run check -- --live   # real Gemini; cloud access probe only when explicitly enabled
```

## AWS EC2 alternative to managed Transcribe

Run open-source faster-whisper on an eligible EC2 instance while remaining on the AWS Free account plan. AWS credits cover eligible compute usage; this code neither changes your account plan nor purchases a service. Instance eligibility must be checked in your own console. Use an x86 Ubuntu 24.04 instance with at least 4 GB RAM, such as a **Free tier eligible** `c7i-flex.large`. Captions arrive in four-second batches plus processing time; latency needs an actual EC2 measurement.

1. Run `node scripts/prepare-ec2.js`. It creates private `.generated/cloud-init.yaml`, a random worker token and `worker.env`. None are committed.
2. EC2 → Launch instance: name `waitwhat-speech`; Ubuntu 24.04 x86_64; a Free tier eligible instance with at least 4 GB RAM; 16 GB gp3 storage; your SSH key pair. Allow SSH from your IP, HTTP 80 and HTTPS 443. Do not expose port 8000. Keep the account on the Free plan.
3. Advanced details → User data: paste the generated `cloud-init.yaml`. Review and launch one instance.
4. At Porkbun, add an A record for `transcribe.waitwhat.study` to the instance's public IPv4 address. Keep the main website record unchanged. An instance stop/start may change this IP.
5. Cloud-init installs Python, Caddy, faster-whisper and a systemd worker. First startup downloads the small English model. In the EC2 terminal, check `cloud-init status --wait`, `systemctl status whisper` and `journalctl -u whisper --no-pager -n 20`.
6. Append `.generated/worker.env` to the deployed backend's existing private `.env`, preserving its database configuration. Set `VITE_TRANSCRIPTION_PROVIDER=whisper` for the frontend build. Restart the backend and deploy the rebuilt frontend.

Caddy exposes HTTPS only to the current Vultr backend IP (`155.138.204.14`); the worker also requires its bearer token. Audio stays in memory and is not written to disk. The Python service binds only to loopback. The adapter uses a bounded buffer and a five-second request deadline, then falls back to the browser if inference fails or is too slow. Up to two classroom streams are allowed, with a one-hour session limit. A GPU is unnecessary for the small CPU model.

## Optional managed Amazon Transcribe

Not enabled by default. The account currently returns `SubscriptionRequiredException`; this is separate from the IAM permission and has not been resolved. Do not switch to a Paid account plan automatically.

If the account later supports the service, put `TRANSCRIBE_ENABLED=true`, `TRANSCRIPTION_PROVIDER=aws`, `AWS_REGION` and scoped credentials in `server/live/.env`; set `VITE_AWS_TRANSCRIBE_ENABLED=true` for the web build. `iam-policy.json` contains only `transcribe:StartStreamTranscription`. The SDK uses the server credential chain; browser clients never receive AWS keys.

Standalone recording test (uses whichever cloud provider you explicitly configured):

```powershell
npm run file -- --file recording.wav
npm run mic -- "Microphone device name"
```

Files must be 16 kHz mono PCM16 WAV or raw `.pcm`. The standalone microphone command requires FFmpeg. List Windows input devices with `ffmpeg -list_devices true -f dshow -i dummy`; macOS uses AVFoundation and Linux uses ALSA. It prints partial/final JSON with stream-relative start/end seconds. The WebSocket wrapper supplies the server session offset, including after reconnects.

File tree: `index.js` (live integration), `aws.js`, `whisper.js`, `queue.js`, `wav.js`, `scripts/` (CLI, health, EC2 preparation), `worker/` (Python inference service), `test/`. The browser integration is in `web/src/host/audio.js`, `pcm.js`, `pcm-worklet.js` and `LiveScreen.jsx`.

Tests cover PCM resampling at 16/44.1/48 kHz, queue bounds, partial/final persistence, duplicate finals, reconnect offsets, server-only browser timestamps, provider failures, EC2 batching, and WAV validation. A real microphone test, EC2 latency check and provider access test remain necessary on actual hardware; simulation results do not prove recognition quality.
