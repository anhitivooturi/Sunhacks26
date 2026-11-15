# AGENTS.md: Wait, what?

Instructions for AI coding agents (Cursor, Claude Code, Codex, Copilot) working in this repo.
The user's chat instructions override this file. The closest AGENTS.md to the file you edit wins.

## What this is
**Wait, what?** shows professors where a lecture lost the class, explains why, fixes it, and checks the fix
worked. Students join with a QR code and tap Lost / Slow down / Speed up / Got it. Every tap is pinned to
the live transcript. Built at SunHacks 2026 (24 hours): keep everything simple and demo-ready.

## Who owns what (don't edit other people's folders without asking)
| Path | Owner |
|---|---|
| `server/live`, deployment | Person A |
| `server/transcribe`, `server/ai` | Person B |
| `web/src/host`, `web/src/report`, `web/src/lib`, `web/src/components` | Person C |
| `web/src/student`, `fixtures/`, `server/atlas`, `docs/pitch` | Person D |
| `docs/contract.md`, `AGENTS.md`, `DESIGN.md`, `web/tailwind.config.js` | Shared: tell the team before changing |

## Hard rules
- **Never change `docs/contract.md` or the report JSON shape without telling the team.** Every WebSocket
  message is `{ "type": ..., "data": { ... } }`.
- **The server computes every timestamp** (seconds since the host clicked Start). Clients never send times.
- **Mocks first.** Every screen must work with `VITE_USE_MOCK=true` and the shared `fixtures/`, so nobody is
  blocked on a teammate.
- **Bad Wi-Fi is the default.** Reconnect with backoff, queue clicks while offline, show a fallback, never a
  blank screen.
- No auth systems, no new frameworks, no new databases. Small commits.
- UI follows `DESIGN.md` (brand) and `docs/design/web-interface-guidelines.md` (Vercel rules). The product
  name in the UI is "Wait, what?", not "Pulse".

## Commands
```bash
cd web && npm install      # first time
cd web && npm run dev      # http://localhost:5173 (mock data by default)
cd web && npm run build    # must pass before you push
node scripts/build-fixtures.mjs   # regenerate fixtures (Person D)
```
- Real backend locally: `cd server/live && npm ci && npm run demo` (memory mode, no database; set
  `BASE_URL=http://localhost:5173` in `server/live/.env` so join links open the web app). Then set
  `VITE_USE_MOCK=false` in `web/.env`, or open any page with `?mock=0`.
- Real backend:  set `VITE_USE_MOCK=false` in `web/.env`. Vite proxies `/sessions`, `/notes`, `/ws` to
  `localhost:3000` and `/api` to the Atlas server.
- Any page: add `?mock=1` or `?mock=0` to override.
- After changing `web/tailwind.config.js`, restart the dev server (Vite doesn't always pick it up).

## Routes
| Route | Screen |
|---|---|
| `/host` | Professor start: label the class (course, section, lecture), then QR + join code |
| `/host/:id`, `/host/:id/ta` | Live screen (calm by design: meter, questions, where they got lost; transcript is a hidden drawer; Pause / Resume / End), TA view |
| `/report/:id?m=<momentId>` | One lecture's report (Detect, Explain, Fix, Verify) + transcript review |
| `/classes?course=&section=&lecture=` | All classes overall + one selected class |
| `/j/:code`, `/join`, `/s/:code`, `/review/:sessionId` | Student app |

## Before you push
1. `npm run build` passes in `web/`.
2. Click through your screen with mock data and check the browser console has no errors.
3. Pull first (`git pull --rebase`); never force-push `main`.

## Student app notes (Person D)
- Student styles live in `web/src/student/student.css`, scoped under `.ww`. No global selectors there.
- `node scripts/ui-audit.mjs` (with `npm run dev` running and `npm i -D playwright` once) checks 44px targets, 16px inputs,
  `transition: all`, keyboard activation, focus rings, one `h1` per screen and page titles in a real browser. Run it before pushing student changes.
- MongoDB Atlas (settings, saved notes, questions) is the `server/atlas` service on :3001. `cd server/atlas && npm install && npm run check && npm run dev`;
  `npm test` needs no database. The app proxies `/api` to it and still works (saving to the phone) when it is down. Details in `server/atlas/README.md`.
- Student `DESIGN.md` details (tap stickers, notebook page) are in `web/src/student/DESIGN.md`; the shared brand rules are in the root `DESIGN.md`.
