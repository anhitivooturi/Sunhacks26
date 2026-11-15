# Pulse

Pulse detects where a lecture lost the class, explains why, fixes it, and verifies the fix worked.

- Shared contract: [docs/contract.md](docs/contract.md). Don't change it without telling the team.
- `web/`: one Vite + React + Tailwind app for every screen.
  - `src/host`, `src/report`: Person C (professor start, live and report screens)
  - `src/student`: Person D (replace `StudentPlaceholder.jsx` with the join, tap, quiz and review screens)
  - `src/host/audio.js`: Person B plugs the live audio stream into `startAudio`
  - `src/lib`: shared helpers (feed, API, formatting, theme)
- `server/`: Person A (live) and Person B (transcribe, ai)

## Run the web app

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173/host.

- `web/.env` has `VITE_USE_MOCK=true`, so every screen works with mock data and no backend.
- Set `VITE_USE_MOCK=false` to use the real server. Vite proxies `/sessions`, `/notes`, `/health` and `/ws` to `http://localhost:3000` (override with `PULSE_API=...`).
- Add `?mock=1` or `?mock=0` to any URL to override the setting for that page.

## Screens (Person C)

| Route | What it is |
|---|---|
| `/host` | Start session: big button, then the code, QR and join URL sized for a lecture hall, mic check and transcription toggle |
| `/host/:id` | Live: calm confusion meter, live transcript with "lost here" markers, live confusion moments with Push fix and quiz progress, top questions, Pulse check, End session |
| `/host/:id/ta` | TA mode: the same live view without the controls, for a second window |
| `/report/:id` | Report: timeline by topic, moment panel with highlighted quote and reason, before/after, fix and quiz with copy / push / save, topics table, delivery stats, unanswered questions, editable recap |

## Student app (Person D)

`web/src/student` has the join, tap, quiz and review screens (routes `/j/:code`, `/join`, `/s/:code`, `/review/:sessionId`). Try it with no backend: `cd web && npm install && npm run dev`, open `/join`, tap "try the demo". Details in [`web/src/student/README.md`](web/src/student/README.md).

- `fixtures/`: shared demo lecture (transcript, events, report). Regenerate with `node scripts/build-fixtures.mjs`. See [`fixtures/README.md`](fixtures/README.md).
- `server/atlas/`: MongoDB Atlas routes for student settings and notes. See [`server/atlas/README.md`](server/atlas/README.md).
- `docs/pitch/`: Devpost draft, 3-minute demo script, survey and evidence template.
