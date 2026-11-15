// Data layer for the student app: MongoDB Atlas collections student_settings, notes, question_threads.
// Same interface three ways: Atlas (MONGODB_URI set and reachable), a JSON file (no URI, or Atlas down at startup), memory (tests).
// Writes are upserts, so regenerating a note or re-asking a question updates one document instead of piling up copies.
import { MongoClient } from 'mongodb'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '.data.json')
const noteKey = n => `${n.studentId}|${n.sessionId || ''}|${n.momentId || ''}|${n.format}`
const threadKey = t => `${t.studentId}|${t.sessionId || ''}|${t.text}`
const clip = (s, n) => String(s ?? '').slice(0, n)

/** Only these fields ever reach the database (no client-supplied extras). */
export const cleanNote = n => ({ studentId: clip(n.studentId, 40), sessionId: clip(n.sessionId, 60), momentId: clip(n.momentId, 40), format: clip(n.format, 20), content: n.content })
export const cleanThread = t => ({ studentId: clip(t.studentId, 40), sessionId: clip(t.sessionId, 60), text: clip(t.text, 280).trim() })

export function memoryStore({ persist = false } = {}) {
  const db = persist && existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {}
  db.student_settings ||= {}; db.notes ||= []; db.question_threads ||= []
  const flush = () => { if (!persist) return; try { writeFileSync(FILE, JSON.stringify(db)) } catch { /* read-only fs: stay in memory */ } }
  const now = () => new Date().toISOString()
  return {
    kind: persist ? 'file' : 'memory',
    async ping() { return true },
    async getSettings(id) { return db.student_settings[id] || null },
    async saveSettings(id, s) { db.student_settings[id] = { ...s, studentId: id, updatedAt: now() }; flush(); return db.student_settings[id] },
    async listNotes(id, { sessionId } = {}) { return db.notes.filter(n => n.studentId === id && (!sessionId || n.sessionId === sessionId)).sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)).slice(0, 100) },
    async upsertNote(n) {
      const doc = cleanNote(n), i = db.notes.findIndex(x => noteKey(x) === noteKey(doc))
      const saved = { ...doc, createdAt: i >= 0 ? db.notes[i].createdAt : now(), updatedAt: now() }
      if (i >= 0) db.notes[i] = saved; else db.notes.push(saved)
      flush(); return saved
    },
    async listThreads(id, { sessionId } = {}) { return db.question_threads.filter(t => t.studentId === id && (!sessionId || t.sessionId === sessionId)).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, 100) },
    async upsertThread(t) {
      const doc = cleanThread(t); if (!doc.text) return null
      const i = db.question_threads.findIndex(x => threadKey(x) === threadKey(doc))
      if (i >= 0) return db.question_threads[i]
      const saved = { ...doc, createdAt: now() }; db.question_threads.push(saved); flush(); return saved
    },
    async close() {},
  }
}

export async function connectAtlas(uri, dbName, { Client = MongoClient } = {}) { // Client is injectable so tests can check the exact calls without a server
  const client = new Client(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, retryWrites: true })
  await client.connect()
  const db = client.db(dbName)
  const settings = db.collection('student_settings'), notes = db.collection('notes'), threads = db.collection('question_threads')
  await Promise.all([
    settings.createIndex({ studentId: 1 }, { unique: true }),
    notes.createIndex({ studentId: 1, sessionId: 1, momentId: 1, format: 1 }, { unique: true }),
    notes.createIndex({ studentId: 1, updatedAt: -1 }),
    threads.createIndex({ studentId: 1, sessionId: 1, text: 1 }, { unique: true }),
  ])
  const strip = d => d && (delete d._id, d)
  return {
    kind: 'atlas',
    client,
    async ping() { await db.command({ ping: 1 }); return true },
    async getSettings(id) { return strip(await settings.findOne({ studentId: id })) },
    async saveSettings(id, s) { const doc = { ...s, studentId: id, updatedAt: new Date() }; await settings.replaceOne({ studentId: id }, doc, { upsert: true }); return doc },
    async listNotes(id, { sessionId } = {}) { return (await notes.find({ studentId: id, ...(sessionId ? { sessionId } : {}) }).sort({ updatedAt: -1 }).limit(100).toArray()).map(strip) },
    async upsertNote(n) {
      const doc = cleanNote(n), at = new Date()
      const { content, ...key } = doc
      await notes.updateOne(key, { $set: { content, updatedAt: at }, $setOnInsert: { createdAt: at } }, { upsert: true })
      return { ...doc, updatedAt: at }
    },
    async listThreads(id, { sessionId } = {}) { return (await threads.find({ studentId: id, ...(sessionId ? { sessionId } : {}) }).sort({ createdAt: -1 }).limit(100).toArray()).map(strip) },
    async upsertThread(t) {
      const doc = cleanThread(t); if (!doc.text) return null
      await threads.updateOne(doc, { $setOnInsert: { createdAt: new Date() } }, { upsert: true })
      return doc
    },
    async close() { await client.close() },
  }
}

export async function createStore(uri = process.env.MONGODB_URI, dbName = process.env.MONGODB_DB || 'pulse') {
  if (!uri) { console.warn('[atlas] MONGODB_URI not set: using the local JSON file store (data is NOT in Atlas)'); return memoryStore({ persist: true }) }
  try {
    const store = await connectAtlas(uri, dbName)
    console.log(`[atlas] connected to MongoDB Atlas, database "${dbName}"`)
    return store
  } catch (e) {
    console.warn(`[atlas] could not reach Atlas (${e.message}). Falling back to the local JSON file store. Run "npm run check" to see why.`)
    return memoryStore({ persist: true })
  }
}
