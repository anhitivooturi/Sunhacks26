// No Mongo server is needed: a recording fake stands in for the driver and we assert the exact calls we make.
// This checks the shape of the operations (indexes, upsert filters, operators). It does NOT prove behaviour on a real cluster:
// run `npm run check` against Atlas for that.
import test from 'node:test'
import assert from 'node:assert/strict'
import { connectAtlas } from '../store.js'

function fakeClient() {
  const log = [], docs = {}
  const coll = name => {
    docs[name] ||= []
    return {
      createIndex: async (keys, opts) => { log.push(['createIndex', name, keys, opts || {}]) },
      replaceOne: async (f, d, o) => { log.push(['replaceOne', name, f, d, o]); docs[name] = docs[name].filter(x => x.studentId !== f.studentId).concat(d) },
      updateOne: async (f, u, o) => {
        log.push(['updateOne', name, f, u, o])
        const both = Object.keys(u.$set || {}).filter(k => k in (u.$setOnInsert || {}))
        if (both.length) throw new Error(`Updating the path '${both[0]}' would create a conflict`) // what real MongoDB does
        let d = docs[name].find(x => Object.entries(f).every(([k, v]) => x[k] === v))
        if (!d) { d = { ...f, ...(u.$setOnInsert || {}) }; docs[name].push(d) }
        Object.assign(d, u.$set || {})
      },
      findOne: async f => docs[name].find(x => Object.entries(f).every(([k, v]) => x[k] === v)) || null,
      find: f => ({ sort: s => ({ limit: () => ({ toArray: async () => { log.push(['find', name, f, s]); return docs[name].filter(x => Object.entries(f).every(([k, v]) => x[k] === v)).map(x => ({ _id: 'x', ...x })) } }) }) }),
    }
  }
  class Client { constructor(uri, o) { log.push(['client', o]); this.db = () => ({ collection: coll, command: async c => { log.push(['command', c]) } }) } async connect() {} async close() { log.push(['close']) } }
  return { Client, log, docs }
}

test('indexes: settings are unique per student, notes per student+session+moment+format, threads per student+session+text', async () => {
  const { Client, log } = fakeClient()
  await connectAtlas('mongodb+srv://u:p@c.mongodb.net/', 'pulse', { Client })
  const idx = log.filter(l => l[0] === 'createIndex').map(l => `${l[1]}:${Object.keys(l[2]).join('+')}${l[3].unique ? ' unique' : ''}`)
  assert.ok(idx.includes('student_settings:studentId unique'))
  assert.ok(idx.includes('notes:studentId+sessionId+momentId+format unique'))
  assert.ok(idx.includes('question_threads:studentId+sessionId+text unique'))
  assert.equal(log.find(l => l[0] === 'client')[1].serverSelectionTimeoutMS, 5000, 'fails fast instead of hanging on bad Wi-Fi')
})

test('upsertNote keys on the identity fields only and puts content in $set (never in the filter)', async () => {
  const { Client, log } = fakeClient()
  const store = await connectAtlas('mongodb+srv://u:p@c.mongodb.net/', 'pulse', { Client })
  await store.upsertNote({ studentId: 's1', sessionId: 'demo', momentId: 'm1', format: 'bullets', content: ['a'], junk: 1 })
  await store.upsertNote({ studentId: 's1', sessionId: 'demo', momentId: 'm1', format: 'bullets', content: ['b'] })
  const ups = log.filter(l => l[0] === 'updateOne')
  assert.deepEqual(ups[0][2], { studentId: 's1', sessionId: 'demo', momentId: 'm1', format: 'bullets' })
  assert.deepEqual(Object.keys(ups[0][3].$set).sort(), ['content', 'updatedAt'])
  assert.deepEqual(Object.keys(ups[0][3].$setOnInsert), ['createdAt'])
  assert.equal(ups[0][4].upsert, true)
  const notes = await store.listNotes('s1', { sessionId: 'demo' })
  assert.equal(notes.length, 1); assert.deepEqual(notes[0].content, ['b']); assert.ok(!('_id' in notes[0]), 'internal _id is stripped')
})

test('threads: same question twice is one document; empty text is ignored', async () => {
  const { Client, docs } = fakeClient()
  const store = await connectAtlas('mongodb+srv://u:p@c.mongodb.net/', 'pulse', { Client })
  await store.upsertThread({ studentId: 's1', sessionId: 'HACK', text: 'What is a base case?' })
  await store.upsertThread({ studentId: 's1', sessionId: 'HACK', text: 'What is a base case?' })
  assert.equal(await store.upsertThread({ studentId: 's1', sessionId: 'HACK', text: '  ' }), null)
  assert.equal(docs.question_threads.length, 1)
})

test('settings are replaced whole, keyed by studentId', async () => {
  const { Client, log } = fakeClient()
  const store = await connectAtlas('mongodb+srv://u:p@c.mongodb.net/', 'pulse', { Client })
  await store.saveSettings('s1', { font: 'dyslexic' })
  const r = log.find(l => l[0] === 'replaceOne')
  assert.deepEqual(r[2], { studentId: 's1' }); assert.equal(r[3].studentId, 's1'); assert.equal(r[4].upsert, true)
  assert.equal((await store.getSettings('s1')).font, 'dyslexic')
})
