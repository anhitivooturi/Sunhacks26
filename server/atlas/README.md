# Atlas routes (Person D)

Fastify plugin for the student app: `student_settings`, `notes`, `question_threads` in MongoDB Atlas.

```bash
cd server/atlas && npm install && npm run dev      # :3001, falls back to a JSON file without MONGODB_URI
```

Person A can mount it in `/server/live` instead: `app.register((await import('../atlas/routes.js')).default)`.

| Route | |
|---|---|
| `GET/PUT /api/student/:studentId/settings` | caption size, font, contrast, note format, haptics, sound |
| `GET /api/student/:studentId/notes` | saved study notes |
| `GET/POST /api/student/:studentId/threads` | question threads |
| `POST /notes` | PROPOSED contract route: `{sessionId, momentId, studentId, format}` -> `{format, content}`. Uses `generateNotes` from `../ai/index.js` if present, else canned notes. The app also sends `passage` and `moment` so a stub can answer without looking the moment up. |
