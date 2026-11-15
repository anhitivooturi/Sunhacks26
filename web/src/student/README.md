# Student app (Person D)

Routes (mounted from `web/src/App.jsx` via `routes.jsx`):

| Route | What |
|---|---|
| `/j/:code` | The QR link from the contract. Auto-joins. |
| `/join` | Type the 4-letter code. Landing page. |
| `/s/:code` | Live class: four tap buttons, Ask, Captions, Settings. A pushed fix opens the quiz sheet. |
| `/review/:sessionId` | "You were lost here" notebook: heat graph, moments, re-explanation, quiz, study notes. |

Try it with no backend: run `npm run dev` in `web/`, open `/join`, tap "try the demo" (code `HACK`). In mock mode `__pulsePush(0)` in the console pushes a fix to the phone (it also auto-pushes after 60 s).

Real server: `VITE_USE_MOCK=false` in `web/.env` (or `?mock=0`). The app sends and receives the contract envelope `{type, data}`.

- `lib/` socket (real + mock), haptics / sound / confetti (`fx.js`), api with fixture fallbacks.
- `components/` Pip the mascot, tap buttons, quiz, note maker, settings.
- `student.css` all student styles, scoped under `.ww` so nothing leaks into the host and report pages.
- Fixtures come from `/fixtures` via the `@fixtures` alias.
- Settings persist to Atlas through `server/atlas` (falls back to localStorage if it is not running).
