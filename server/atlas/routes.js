// Fastify plugin: `app.register(pulseStudentRoutes)` (Person A can mount this in /server/live) or run server/dev-server.js.
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
  const id = req => String(req.params.studentId || '').slice(0, 40)

  app.get('/api/student/:studentId/settings', async (req, reply) => (await store.getSettings(id(req))) || reply.code(404).send({ error: 'none' }))
  app.put('/api/student/:studentId/settings', async req => {
    const b = req.body || {}, clean = {}
    for (const [k, allowed] of Object.entries(SETTINGS_OK)) if (allowed.includes(b[k])) clean[k] = b[k]
    return store.saveSettings(id(req), clean)
  })
  app.get('/api/student/:studentId/notes', async req => store.listNotes(id(req)))
  app.get('/api/student/:studentId/threads', async req => store.listThreads(id(req)))
  app.post('/api/student/:studentId/threads', async req => store.saveThread({ ...(req.body || {}), studentId: id(req) }))

  // generate + save in one call
  app.post('/notes', async (req, reply) => {
    const { studentId, sessionId, momentId, passage, format, moment } = req.body || {}
    if (!FORMATS.includes(format) || typeof passage !== 'string') return reply.code(400).send({ error: 'bad request' })
    const note = await makeNote({ passage, format, moment })
    if (studentId) await store.addNote({ studentId, sessionId, momentId, ...note })
    return note
  })
  app.get('/api/student/health', async () => ({ ok: true, store: store.kind }))
}
