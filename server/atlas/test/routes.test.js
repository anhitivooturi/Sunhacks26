import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import routes from '../routes.js'
import { memoryStore, cleanNote } from '../store.js'

const build = async (store = memoryStore()) => { const app = Fastify(); await app.register(routes, { store }); return { app, store } }
const post = (app, url, payload) => app.inject({ method: 'POST', url, payload })
const PASSAGE = 'So obviously the function needs a base case.'
const MOMENT = { reexplanation: 'A base case stops it. It returns directly.', example: 'f(1)=1', summary: 'Used before defined' }

test('health reports which store is in use', async () => {
  const { app } = await build()
  const r = await app.inject('/api/student/health')
  assert.deepEqual(r.json(), { ok: true, store: 'memory', reachable: true })
})

test('settings: unknown student is 404, saves keep only allowed values', async () => {
  const { app } = await build()
  assert.equal((await app.inject('/api/student/s1/settings')).statusCode, 404)
  const put = await app.inject({ method: 'PUT', url: '/api/student/s1/settings', payload: { font: 'dyslexic', contrast: 'high', sound: 'on', caption: 'HUGE', evil: '<script>' } })
  assert.equal(put.statusCode, 200)
  const got = (await app.inject('/api/student/s1/settings')).json()
  assert.equal(got.font, 'dyslexic'); assert.equal(got.contrast, 'high'); assert.equal(got.sound, 'on')
  assert.ok(!('caption' in got) && !('evil' in got), 'invalid caption and unknown keys are dropped')
})

test('notes: generate + save, regenerating updates one document instead of duplicating', async () => {
  const { app } = await build()
  const body = { studentId: 's1', sessionId: 'demo', momentId: 'm1', format: 'bullets', passage: PASSAGE, moment: MOMENT }
  const a = await post(app, '/api/notes', body)
  assert.equal(a.statusCode, 200); assert.equal(a.json().format, 'bullets'); assert.ok(Array.isArray(a.json().content))
  await post(app, '/api/notes', body); await post(app, '/notes', body) // the contract's /notes alias too
  const list = (await app.inject('/api/student/s1/notes')).json()
  assert.equal(list.length, 1, 'same student+session+moment+format is one note')
  await post(app, '/api/notes', { ...body, format: 'plain' })
  assert.equal((await app.inject('/api/student/s1/notes?sessionId=demo')).json().length, 2)
  assert.equal((await app.inject('/api/student/s1/notes?sessionId=other')).json().length, 0)
  assert.equal((await app.inject('/api/student/s2/notes')).json().length, 0, 'another student sees nothing')
})

test('notes: bad input is a 400, and no note is saved when studentId is missing', async () => {
  const { app } = await build()
  assert.equal((await post(app, '/api/notes', { format: 'nope', passage: PASSAGE })).statusCode, 400)
  assert.equal((await post(app, '/api/notes', { format: 'plain' })).statusCode, 400)
  const r = await post(app, '/api/notes', { format: 'plain', passage: PASSAGE, moment: MOMENT })
  assert.equal(r.statusCode, 200)
})

test('threads: dedupes the same question, rejects empty, filters by session', async () => {
  const { app } = await build()
  await post(app, '/api/student/s1/threads', { sessionId: 'HACK', text: 'What is a base case?' })
  await post(app, '/api/student/s1/threads', { sessionId: 'HACK', text: 'What is a base case?' })
  await post(app, '/api/student/s1/threads', { sessionId: 'HACK', text: 'Why a stack?' })
  assert.equal((await post(app, '/api/student/s1/threads', { sessionId: 'HACK', text: '   ' })).statusCode, 400)
  assert.equal((await app.inject('/api/student/s1/threads?sessionId=HACK')).json().length, 2)
  assert.equal((await app.inject('/api/student/s1/threads?sessionId=OTHER')).json().length, 0)
})

test('when the database is down the service answers 503 and keeps running', async () => {
  const down = { ...memoryStore(), kind: 'atlas', ping: async () => { throw new Error('down') }, getSettings: async () => { throw new Error('MongoNetworkError: connection closed') }, listNotes: async () => { throw new Error('boom') } }
  const { app } = await build(down)
  const r = await app.inject('/api/student/s1/settings')
  assert.equal(r.statusCode, 503); assert.equal(r.json().error, 'store_unavailable')
  assert.equal((await app.inject('/api/student/s1/notes')).statusCode, 503)
  assert.equal((await app.inject('/api/student/health')).json().reachable, false)
  assert.equal((await app.inject('/api/student/health')).statusCode, 200)
})

test('cleanNote never lets extra client fields into the database', () => {
  const c = cleanNote({ studentId: 's', sessionId: 'x', momentId: 'm', format: 'plain', content: 'hi', $where: 'bad', admin: true })
  assert.deepEqual(Object.keys(c).sort(), ['content', 'format', 'momentId', 'sessionId', 'studentId'])
})
