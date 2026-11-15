# Wait, what? Find where the lecture lost the class, fix it, and prove the fix worked

## Inspiration
In a 200-person lecture, the TA hears the confusion before the professor does: the half-raised hands, the whispers of "wait, what's a base case?". The professor hears none of it. Students sit lost for ten minutes, then miss the next twenty. Raising a hand costs social courage, and a quiet class looks the same as a lost one. We built the TA's ear for every lecture hall.

## What it does: Detect, Explain, Fix, Verify
**Students** scan a QR code (no login, anonymous) and get four huge buttons: Lost, Slow down, Speed up, Got it. One tap, a haptic buzz, and the phone gets out of the way. They can also ask anonymous questions and upvote others'.
**Professors** click Start, teach, and read one report. A calm live meter shows "X of Y students lost" beside a live transcript.
1. **Detect:** every tap is stamped against the live transcript, and a confusion map shows where the class lost the thread.
2. **Explain:** Gemini names the reason (undefined term, skipped step, too fast, no example, assumed prior knowledge) and quotes the exact words, copied word for word from the transcript.
3. **Fix:** a two-sentence re-explanation, one example, and a 3-question quiz for each moment. Push it to every phone, or read it aloud.
4. **Verify:** students answer the quiz and the confusion score updates, with a confidence label so the numbers stay honest.
Students get a personal "You were lost here" review with printable notes, available as flashcards, a concept diagram, short bullets or plain language.

## How we built it
- **Tiger Data (Postgres + Timescale):** events live in a hypertable with a 10-second continuous aggregate that powers the live meter and moment detection.
- **MongoDB Atlas:** student settings (caption size, dyslexia-friendly font, contrast), saved notes and question threads.
- **Amazon Transcribe:** streaming 16 kHz transcription with a Web Speech fallback, so the transcript never stops on bad Wi-Fi.
- **Gemini:** JSON-schema outputs validated with zod, an exact-substring check on evidence quotes, and cached fallbacks.
- **Vultr + Caddy + GoDaddy:** one VM, automatic HTTPS, WebSocket proxying.
- **React + Vite + Tailwind, Fastify + ws:** the student app works fully offline against fixtures first.

## Challenges
Timing: students tap *after* the confusing sentence, so we map each tap to a window 20 to 4 seconds earlier. Keeping a one-tap UI honest on bad conference Wi-Fi (queued taps, backoff reconnects). Making AI explanations trustworthy: a quote that isn't verbatim gets dropped rather than invented.

## Accomplishments
A complete closed loop from tap to verified fix, a student UI people actually want to open, and real-session evidence: [N] students, [N] taps, [N] peaks found, [N] confirmed by the group.

## What's next
Per-course history, TA dashboards, multi-language captions, LMS export.
