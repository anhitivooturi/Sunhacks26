# Lecture AI (Person B)

`index.js` exports `splitTopics`, `explainMoment`, `generateFix`, `generateRecap`, `generateNotes` and `computeDeliveryStats`. The existing live adapter imports these automatically. Atlas imports `generateNotes` when its service is running.

Run `npm ci` here, then add `GEMINI_API_KEY` to ignored `server/live/.env`. The default model is `gemini-3.1-flash-lite`, which offers a free tier. Keep Google billing disabled if you want free-quota-only usage. No AWS service is used by these functions.

Every request uses JSON Schema and Zod validation, temperature 0.25 and one whole-call deadline of 18 seconds. Invalid output retries once with the validation error. Evidence quotes must be exact substrings of the passage, at most 25 words; a quote that fails twice is dropped. Failed requests use explicit fixture or passage-based backups. Latency and source are logged without API keys. Duplicate inputs share a bounded cache.

```powershell
npm test                         # offline, no keys or paid requests
npm run fixtures                 # all functions using backups
npm run check -- --write-cache   # real Gemini requests; save successful demo outputs
```

The demo cache lives under ignored `.cache/demo.json`; deploy it privately alongside this module. The report JSON shape remains unchanged. `computeDeliveryStats` is a separate pure function: words/minute uses transcript duration, example gaps use explicit example phrases, and jargon checks use a documented small vocabulary and definition cues. These are transcript heuristics, not claims about actual speaking speed or teaching quality.

File tree: `index.js` (provider and functions), `prompts.js`, `schemas.js`, `fallbacks.js`, `delivery-stats.js`, `scripts/fixtures.js`, `test/ai.test.js`.

Validation: six offline tests cover retries, quote grounding, exact quiz shape, topic continuity, deadlines, caching and statistics. All ten real fixture calls passed after setup, including all four notes formats. Quota exhaustion can still cause later calls to use backups.
