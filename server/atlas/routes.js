// Fastify plugin for the student app. Run standalone (dev-server.js) or mount it in another Fastify app:
//   app.register((await import('../atlas/routes.js')).default)
// Failure rule: if the database is unreachable at request time we answer 503, and the student app falls back to localStorage.
import { createStore } from './store.js'
import { buildCannedNote } from '../../web/src/student/lib/notesCanned.js'

const FORMATS = ['flashcards', 'diagram', 'bullets', 'plain']
const SETTINGS_OK = { caption: ['sm', 'md', 'lg', 'xl'], font: ['default', 'atkinson', 'dyslexic'], contrast: ['normal', 'high'], noteFormat: FORMATS, sound: ['on', 'off'], haptics: ['on', 'off'] }

// Person B's generateNotes(passage, format) if it exists; otherwise canned output. Never throws.
async function makeNote({ passage, format, moment }) {
  try {
    const mod = await import('../ai/index.js')
    if (typeof mod.generateNotes === 'function') {
      const out = await mod.generateNotes(passage, format)
      const content = out?.content ?? out
      if (content) return { format, content }
    }
  } catch { /* module missing or Gemini down: fall through */ }
  return buildCannedNote(moment || { passage, reexplanation: passage, example: '', whyConfusing: '' }, format)
}

export default async function pulseStudentRoutes(app, opts = {}) {
  const store = opts.store || (await createStore())
  const sid = req => String(req.params.studentId || '').slice(0, 40)
  const session = req => (typeof req.query?.sessionId === 'string' ? req.query.sessionId.slice(0, 60) : undefined)

  app.setErrorHandler((err, req, reply) => {
    if (err.validation || err.statusCode < 500) return reply.send(err)
    req.log.error(err)
    reply.code(503).send({ error: 'store_unavailable', message: 'The database is unreachable. Your data is still saved on this device.' })
  })

  app.get('/api/student/health', async () => ({ ok: true, store: store.kind, reachable: await store.ping().catch(() => false) }))

  app.get('/api/student/:studentId/settings', async (req, reply) => (await store.getSettings(sid(req))) || reply.code(404).send({ error: 'none' }))
  app.put('/api/student/:studentId/settings', async req => {
    const b = req.body || {}, clean = {}
    for (const [k, allowed] of Object.entries(SETTINGS_OK)) if (allowed.includes(b[k])) clean[k] = b[k]
    return store.saveSettings(sid(req), clean)
  })

  app.get('/api/student/:studentId/notes', async req => store.listNotes(sid(req), { sessionId: session(req) }))
  app.get('/api/student/:studentId/threads', async req => store.listThreads(sid(req), { sessionId: session(req) }))
  app.post('/api/student/:studentId/threads', async (req, reply) => {
    const saved = await store.upsertThread({ ...(req.body || {}), studentId: sid(req) })
    return saved || reply.code(400).send({ error: 'empty question' })
  })

  // Generate study notes and save them (one document per student + session + moment + format).
  // `/api/notes` is what the student app calls; `/notes` is the same handler for the contract's PROPOSED route.
  const generate = async (req, reply) => {
    const { studentId, sessionId, momentId, passage, format, moment } = req.body || {}
    if (!FORMATS.includes(format) || typeof passage !== 'string' || !passage) return reply.code(400).send({ error: 'format and passage are required' })
    const note = await makeNote({ passage, format, moment })
    if (studentId) { try { await store.upsertNote({ studentId, sessionId, momentId, ...note }) } catch (e) { req.log.warn(e, 'could not save note, returning it anyway') } }
    return note
  }
  app.post('/api/notes', generate)
  app.post('/notes', generate)
}
