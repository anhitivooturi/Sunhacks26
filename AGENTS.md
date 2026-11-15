# AGENTS.md

Guidance for coding agents working in this repo. Humans: see [README.md](README.md).

## What this is
"Wait, what?" (codename Pulse). Students tap Lost / Slow down / Speed up / Got it during a lecture. The server detects where the class got lost, Gemini explains and fixes it, and quiz answers verify the fix.

## Layout
- `web/`: one Vite + React 18 + Tailwind **3** app for every screen.
  - `src/host`, `src/report`: professor screens (Person C).
  - `src/student`: student screens (Person D). Its own `student.css`, scoped under `.ww`.
- `server/`: `live` (Person A), `transcribe` and `ai` (Person B), `atlas` (Person D).
- `fixtures/`: shared demo lecture (transcript, events, report). `scripts/build-fixtures.mjs` regenerates and validates them.
- `docs/contract.md`: the frozen API contract. `docs/pitch/`: Devpost, demo script, survey.

## Commands
- Install and run the web app: `cd web && npm install && npm run dev` (http://localhost:5173).
- Build: `cd web && npm run build`.
- No backend needed: `web/.env` has `VITE_USE_MOCK=true`. Use `?mock=0` or set it to `false` for the real server.
- Regenerate fixtures: `node scripts/build-fixtures.mjs` (fails if an evidence quote is not an exact substring of the transcript).
- Atlas routes: `cd server/atlas && npm install && npm run dev` (works without `MONGODB_URI`, using a JSON file).
- UI audit (needs `npm i -D playwright` once): `cd web && npm run dev` in one terminal, then `node scripts/ui-audit.mjs`.

## Hard rules
- **Never edit `docs/contract.md` or the report JSON shape.** If a change seems needed, stop and ask. Messages are `{ type, data }`. Tap kinds are `lost | slow | fast | got_it`.
- The server computes all timestamps (`transcript_ts_sec`). Clients never send timestamps.
- Stay inside your owner's folders. The shared files `web/src/App.jsx`, `web/package.json`, `web/tailwind.config.js` and `web/vite.config.js` take **additive** edits only.
- Do not upgrade Tailwind to v4 or React to 19. Use the `@tailwind base/components/utilities` directives.
- Student styles live in `web/src/student/student.css` and are scoped under `.ww`. Do not add global selectors (`body`, `html`, bare element rules) there.
- Every module must work against fixtures first, so nobody is blocked on a teammate. Handle failure gracefully: the demo runs on bad conference Wi-Fi.
- No auth systems and no over-engineering.

## UI conventions (student app)
Follow `web/src/student/DESIGN.md`. In short:
- Mobile hit targets are at least 44px. Inputs are at least 16px. Never `transition: all`; list properties.
- Every interactive element works with a keyboard and shows `:focus-visible`. Pointer-only handlers need a keyboard path.
- Respect `prefers-reduced-motion`. Animate `transform` and `opacity`. Keep celebration for milestones (quiz result), not every tap.
- Every screen sets `<title>` via `usePageTitle`, has one `h1`, and designs its empty, loading, error and offline states.
- Use tabular numbers (`tnum`) for anything that counts or ticks.

## Verify UI changes in a real browser
1. Screenshot at 390x844 (phone) and 1440x900 (desktop). Look at them; do not assume.
2. Run `node scripts/ui-audit.mjs` and fix anything it reports.
3. Check the accessibility tree (`page.locator('body').ariaSnapshot()`) for unnamed controls and heading order.
4. Press Tab and Enter through the main flow: join, tap, ask, quiz, review.
5. Throttle or go offline once to see the reconnecting banner.

## Commits and PRs
Small commits. Do not push to `main`. Describe which owner folders changed and confirm the contract is untouched.
