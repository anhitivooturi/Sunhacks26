# Wait, what?: Person A

Person A owns this directory: live backend, database, report orchestration, verification, demo tooling, and deployment. No files in `/server/ai`, `/server/transcribe`, `/web`, `/fixtures`, or `/docs/contract.md` are created or changed here.

The backend is deployed at `https://waitwhat.study/health`. Its source was recovered from the verified deployment archive after the local files went missing. See [VALIDATION.md](VALIDATION.md) for verification and remaining integration work. The `pulse-live` package/process name is retained for compatibility with the running VM.

## Run locally first (PowerShell)

Node 22 or newer is required. From the repository root:

```powershell
cd server/live
npm ci
Copy-Item .env.example .env
npm start
```

Leave that terminal running. In another PowerShell terminal:

```powershell
Invoke-RestMethod http://localhost:3000/health
$session = Invoke-RestMethod -Method Post http://localhost:3000/sessions
$session | Select-Object id, code, joinUrl
Invoke-RestMethod "http://localhost:3000/sessions/$($session.id)/transcript"
Invoke-RestMethod "http://localhost:3000/sessions/$($session.id)/report"
Invoke-RestMethod -Method Post "http://localhost:3000/sessions/$($session.id)/end"
```

`GET /health` returns `{"ok":true}`. No credentials are needed: an empty `DATABASE_URL` uses temporary memory storage. This health endpoint checks the running process, not database readiness. A configured but unavailable database fails writes; it never silently switches to memory and loses data.

For the seeded backup demo, stop the normal server with Ctrl+C, then run:

```powershell
npm run demo
```

This starts memory mode with completed session `DEMX`, its transcript, events, and report. The terminal prints its report URL. New sessions still work. Restarting memory mode deletes data.

For phones on your LAN, set `HOST=0.0.0.0` and `BASE_URL=http://YOUR_LAN_IP:3000` in `.env`, then restart. The `/j/CODE` UI is Person D's work; this backend generates the URL and QR but does not serve a student screen. Browser microphone access needs HTTPS except on localhost. Use the deployment guide for the public demo.

## Files

```text
server/live/
  .env.example
  .gitattributes
  .gitignore
  package.json
  package-lock.json
  README.md
  DEPLOY.md
  VALIDATION.md
  migrations/001_core.sql
  deploy/
    Caddyfile
    deploy.sh
    ecosystem.config.cjs
  src/
    index.js             process startup/shutdown
    config.js            env configuration
    app.js               REST, WS upgrade routing, integration hooks
    rooms.js             rooms, validation, meter, student/host actions
    store.js             memory and Postgres repositories
    questions.js         ranked question projection
    detect-moments.js    pure detector plus session wrapper
    report.js            report job and verification updates
    verification.js     latest-answer correctness and score blending
    ai-adapter.js        optional Person B functions, deadlines, backup
    fixtures.js          A's private backup; reads shared fixtures if present
  scripts/
    migrate.js
    seed.js
    load-seed.js
    demo-server.js
    fake-class.js
  test/
    app.test.js
    detect-moments.test.js
    verification.test.js
    failures.test.js
```

## Database

Create a Tiger Data service using [DEPLOY.md](DEPLOY.md), paste its connection URL into `.env`, then:

```powershell
npm run migrate
npm run seed
npm start
```

The migration creates sessions, transcript chunks, topics, reports, and a Timescale event hypertable indexed on `(session_id, created_at)`. `event_counts_10s` counts events and distinct students per session/type in ten-second wall-clock buckets. Its policy runs every five seconds; real-time aggregation includes the newest unmaterialized rows. The live meter reads exact in-process event windows, so it is not delayed by aggregate refreshes. The database must support TimescaleDB 2.7+ and creating the extension/continuous aggregates. This is intended for current Tiger Data, not plain Postgres.

Migrations are transactionally versioned and locked against concurrent application. Seeding is additive: `DEMX` is reused if present, never overwritten. Do not interrupt the initial seed midway; the small script is not a recovery system for partially imported fixtures.

## REST and WebSocket integration

REST uses the brief's paths without an `/api` prefix:

| Method | Path | Result |
| --- | --- | --- |
| GET | `/health` | `{ok:true}` |
| POST | `/sessions` | 201 `{id,code,joinUrl,qrDataUrl}`; no body required |
| GET | `/sessions/:id/transcript` | array of `{startSec,endSec,text}` |
| GET | `/sessions/:id/report` | saved report, otherwise fixture report with this session ID |
| POST | `/sessions/:id/end` | `{ok:true}` after saving the report; repeated calls reuse it |

Connect to `/ws?code=ABCD&role=student` or `/ws?code=ABCD&role=host`. Optional `&studentId=...` preserves anonymous identity across reconnects. IDs accept letters, digits, underscores and hyphens, up to 128 characters. Save the assigned ID from `welcome` in localStorage. Unknown codes/roles fail before upgrade. Ended sessions remain joinable for fix/quiz review.

Every wire message follows the checked-in contract envelope `{type,data}`, for example:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?code=ABCD&role=student');
ws.onmessage = event => console.log(JSON.parse(event.data));
ws.onopen = () => ws.send(JSON.stringify({ type: 'react', data: { kind: 'lost' } }));
// Reactions: lost | slow | fast | got_it
// Other student messages:
// {type:'question', data:{text:'Why does this stop?'}}
// {type:'upvote', data:{questionId:'...'}}
// {type:'quiz_answer', data:{momentId:'moment-1', qIndex:0, choice:2}}
// Host messages:
// {type:'push_fix', data:{momentId:'moment-1'}}
// {type:'pulse_check', data:{}}
// {type:'mark_answered', data:{questionId:'...'}}
```

Outgoing messages use `{type:'meter',data:{score,lostCount,active}}`, `{type:'transcript',data:{text,final,startSec}}`, `{type:'questions',data:{list}}`, `{type:'push_fix',data:{moment}}`, and `{type:'poll',data:{kind:'pulse_check'}}`. `welcome.data` contains `{sessionId,studentId}` (host ID is null). Questions contain `{id,text,upvotes,answered,transcript_ts_sec}`. Validation/storage failures produce `{type:'error',data:{message}}`. After the frontend pull, A's transport was aligned with the existing frozen `docs/contract.md`; the contract and shared fixtures were not modified. Internal `rooms.send`/`live.broadcast` helpers still accept flat objects and wrap them at the socket boundary.

Clients send no timestamps. Timestamps are captured when the server receives a message. The same reaction kind is silently ignored within three seconds, including after reconnects. Writes complete before broadcasting. Each student can upvote each question once. The meter broadcasts to hosts every two seconds: distinct lost students in 30 seconds / distinct event participants in 120 seconds. Hosts can push generated/saved moments, including after the session ends; new reactions/questions/pulse checks stop at session end.

The server handles ping/pong, bounded messages, slow sockets, and room state recovery from persisted events. Clients own their reconnect/backoff. Reactions have no acknowledgement or replay ID in the supplied contract: avoid automatically replaying all old taps after reconnect. A disconnected host's missed transcript can be fetched using the transcript endpoint, and the question list is replayed on reconnect.

## Hooks for B and D

`buildApp({ register, ai })` accepts existing teammate modules without editing their files. `src/index.js` runs only A's backend by default. Once teammates' modules exist, integrate their exported plugin in the bootstrap:

```javascript
import { buildApp } from './src/app.js';
const app = await buildApp({
  register: async (app, live) => {
    // await registerTranscribe(app, live); // B's own module
    // await app.register(studentSettingsRoutes); // D's own module
  },
});
await app.listen({ host: '127.0.0.1', port: 3000 });
```

`app.live` provides:

```javascript
await app.live.getSession(sessionId);
await app.live.publishTranscript(sessionId, {
  text: 'A base case stops recursion.', final: true, startSec: 0, endSec: 4,
}); // persists finals, then broadcasts the contract transcript message
await app.live.publishTranscript(sessionId, {
  text: 'A base case...', final: false, startSec: 0,
}); // broadcasts partials without persisting
app.live.registerUpgrade('/ws/audio', (request, socket, head) => {
  // B owns the separate audio WebSocketServer.handleUpgrade implementation.
});
app.live.broadcast(sessionId, { type: 'transcript', text: '...', final: false, startSec: 0 });
app.live.store.pool; // pg Pool when Postgres is configured; undefined in memory mode
app.live.store.addTranscript(sessionId, { startSec: 0, endSec: 4, text: '...' });
```

`publishTranscript` is a trusted server integration: B computes offsets from the session's start, rather than trusting student timestamps. It persists the final chunk itself; B must not insert it again. Avoid nesting `publishTranscript` inside `live.serialize` for the same session (that would wait on its own queue).

The AI adapter optionally loads named exports `splitTopics`, `explainMoment`, `generateFix`, and `generateRecap` from `/server/ai/index.js`. Missing functions, import failures, and timeouts use private backup responses; each real call has a configurable 20-second deadline and latency logging. `passageContext` is `{passage,startSec,endSec,transcriptChunks}`. B owns Gemini credentials and its own JSON validation/retry implementation. Backup responses are mock teaching content, not a substitute for the real AI pipeline. Shared fixture files are read when present, never written; errors in present but malformed fixtures are surfaced.

## Detection, report and verification

The detector has tunable constants at the top of `src/detect-moments.js`. Each lost reaction belongs to one ten-second reaction bucket. A bucket needs at least three distinct lost students and the configured fraction of students active in its trailing two minutes. Its transcript window is the union of `[T-20,T-4]` for qualifying taps. Adjacent candidate buckets merge, with students counted once across the merged moment. `detectSessionMoments(store, sessionId, threshold)` is the async session entry point; `detectMoments(events, threshold)` is the fixture-testable pure function.

End locks the session against new reactions, detects moments, loads transcript chunks, calls B's AI functions (or backup), computes topic metrics, and saves one report. The duration is fixed at the first end request. If generation fails, retry that same endpoint. `topics[].confusion` is the lost fraction of that topic's reactions; `understanding` is got_it / all reactions. Report participants are distinct students who sent events, not everyone who opened a socket.

Quiz correctness is checked against the server's saved quiz. The latest answer per student/question counts. `computeResolved(events,momentId)` returns the correct-answer share, or null with no answers. Once answers exist, a moment's score is `0.65 * originalTapScore + 0.25 * quizMissRatio + 0.10 * questionShare` (distinct questioners near the moment / active students, capped at one). No quiz data leaves the tap score unchanged. The original score is saved separately so repeated updates do not compound the blend.

**Contract conflict:** the pasted brief freezes the report JSON and also asks for new confidence/resolution fields. We preserve the stated report shape. `resolved`, original score, verification-participant count, and confidence (low <5, medium 5–14, high >=15 quiz participants) live in `reports.verification` and are available internally through `store.getReport`. They are not added to the HTTP report. C's before/after and confidence UI needs the team to agree on an existing mechanism or authorize a contract change. The brief also mentions a summary and delivery stats that are absent from the frozen report shape; A does not add them.

## Tests and demo load

```powershell
npm test
npm run fake-class -- --self-contained --students 60 --seconds 300 --spike 30 --out artifacts/load-test.json
```

The first uses Node's test runner without child-process isolation for compatibility with this Windows sandbox. Tests cover REST, actual WebSockets, timestamps, role validation, reconnect cooldowns, vote deduplication, question recovery, transcripts, report idempotence, quiz updates, and the pure detector.

The load script creates a session, opens 60 students plus a host, sends reactions every five seconds, and creates a lost spike at 30 seconds. It reports persisted/dropped events, protocol/send errors, disconnects, ping RTT, and meter spacing. Self-contained mode counts exact writes in its local memory backend. To exercise the VM/Tiger Data path:

```powershell
npm run fake-class -- --url https://YOURDOMAIN --students 60 --seconds 300 --spike 30
```

In external mode, exact dropped-message counts are unknown because the frozen protocol has no per-reaction ACK. Ping RTT and meter gaps measure transport/timer responsiveness, not guaranteed database commit latency. Check saved events in Tiger Data for delivery counts. The five-minute test's actual local results and deployment verification limits are recorded in `VALIDATION.md` after execution.

One PM2 process is intentional: rooms and queues are in memory. Do not use multiple workers/VMs without shared pub/sub. Memory mode and the synthetic load test cannot validate a hosted database, TLS, or bad conference Wi-Fi.
