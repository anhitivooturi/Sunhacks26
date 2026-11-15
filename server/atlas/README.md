# Atlas service (Person D)

The student app keeps three things in **MongoDB Atlas**. Everything else (events, sessions, reports) stays in Person A's Postgres/Timescale.

| Collection | What | One document per |
|---|---|---|
| `student_settings` | caption size, font, contrast, note format, haptics, sound | student |
| `notes` | study notes the student generated (flashcards, diagram, bullets, plain) | student + session + moment + format |
| `question_threads` | questions the student asked in class, shown again in their notebook | student + session + question text |

Students are anonymous. The id is a random string kept in their browser, so there is no login and no personal data. Anyone who guesses an id could read that student's settings, notes and questions. That is the accepted hackathon trade-off; do not store anything sensitive here.

## Run it

```bash
cd server/atlas
npm install
cp .env.example .env        # then paste your MONGODB_URI
npm run check               # explains in plain words what is wrong, if anything
npm run dev                 # http://localhost:3001
```

Open http://localhost:3001/api/student/health. `"store":"atlas"` means you are talking to Atlas. `"store":"file"` means it fell back to a local JSON file, and the terminal says why.

The web app proxies `/api` to `:3001` by default (`web/vite.config.js`). Set `PULSE_ATLAS=http://host:port` to point elsewhere.

## Getting the connection string (Atlas)
1. **Database Access**: add a database user with "Read and write to any database". Remember the password.
2. **Network Access**: add your IP. For the demo, add the conference Wi-Fi's IP too (or temporarily `0.0.0.0/0`, and delete it afterwards).
3. Your cluster, **Connect**, **Drivers**, **Node.js**, copy the string, replace `<db_password>`.
4. Put it in `server/atlas/.env` as `MONGODB_URI=`. Never commit `.env` or paste the string in chat.

`npm run check` tests all of that: it logs in, pings, does a test write, lists the three collections, and never prints the password. Collections and their indexes are created automatically on first run.

## Routes
| Route | |
|---|---|
| `GET /api/student/health` | `{ ok, store: "atlas" \| "file" \| "memory", reachable }` |
| `GET/PUT /api/student/:id/settings` | values outside the allowed lists are dropped |
| `GET /api/student/:id/notes?sessionId=` | saved notes, newest first |
| `GET/POST /api/student/:id/threads?sessionId=` | questions; the same question twice is one thread |
| `POST /api/notes` and `POST /notes` | generate and save a note. `/notes` is the contract's PROPOSED route, `/api/notes` is what the app calls because the dev proxy and Caddy send `/api/*` here |

Notes use `generateNotes(passage, format)` from `server/ai/index.js` (Person B) when it exists and canned notes otherwise.

## When something is down
- Atlas unreachable at startup: falls back to the JSON file and says so loudly.
- Atlas unreachable while running: routes answer **503** `store_unavailable`. The student app then keeps working from the phone's own storage, shows "saved on this phone" and "Not saved: you are offline" instead of failing, and never blocks a tap.

## Tests
`npm test` (no database needed): routes against an in-memory store, and the exact calls made to the MongoDB driver (indexes, upsert filters, operators) against a recording fake. These do **not** prove behaviour on a real cluster. `npm run check` against your Atlas does.

## For Person A: deploying next to server/live
Run it as a second process and send `/api/*` to it. Nothing in `server/live` has to change.

```js
// deploy/ecosystem.config.cjs: add an app next to pulse-live
{ name: 'pulse-atlas', cwd: '/srv/pulse/server/atlas', script: 'dev-server.js', env: { API_PORT: 3001, MONGODB_DB: 'pulse' } }
// put MONGODB_URI in server/atlas/.env on the VM (it is gitignored)
```
```caddy
# deploy/Caddyfile: before the catch-all reverse_proxy to :3000
handle /api/* {
    reverse_proxy localhost:3001
}
```
To mount it inside `server/live` instead: `await app.register((await import('../../atlas/routes.js')).default)`.
