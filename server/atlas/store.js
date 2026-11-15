// Mongo helper for Atlas collections: student_settings, notes, question_threads.
// No MONGODB_URI (or Atlas unreachable) => JSON-file fallback with the same API, so nobody is blocked.
import { MongoClient } from 'mongodb'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '.data.json')

function fileStore() {
  const db = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { student_settings: {}, notes: [], question_threads: [] }
  const flush = () => { try { writeFileSync(FILE, JSON.stringify(db)) } catch { /* read-only fs: stay in memory */ } }
  return {
    kind: 'file',
    async getSettings(id) { return db.student_settings[id] || null },
    async saveSettings(id, s) { db.student_settings[id] = { ...s, studentId: id, updatedAt: new Date().toISOString() }; flush(); return db.student_settings[id] },
    async listNotes(id) { return db.notes.filter(n => n.studentId === id).slice(-100) },
    async addNote(n) { const note = { ...n, createdAt: new Date().toISOString() }; db.notes.push(note); flush(); return note },
    async listThreads(id) { return db.question_threads.filter(t => t.studentId === id) },
    async saveThread(t) { db.question_threads.push({ ...t, createdAt: new Date().toISOString() }); flush(); return t },
  }
}

export async function createStore(uri = process.env.MONGODB_URI, dbName = process.env.MONGODB_DB || 'pulse') {
  if (!uri) { console.warn('[pulse-student] MONGODB_URI not set: using local JSON store'); return fileStore() }
  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 })
    await client.connect()
    const db = client.db(dbName)
    const settings = db.collection('student_settings'), notes = db.collection('notes'), threads = db.collection('question_threads')
    await Promise.all([notes.createIndex({ studentId: 1, createdAt: -1 }), threads.createIndex({ studentId: 1, sessionId: 1 })])
    console.log('[pulse-student] connected to MongoDB Atlas')
    const strip = d => d && (delete d._id, d)
    return {
      kind: 'atlas',
      async getSettings(id) { return strip(await settings.findOne({ studentId: id })) },
      async saveSettings(id, s) { const doc = { ...s, studentId: id, updatedAt: new Date() }; await settings.replaceOne({ studentId: id }, doc, { upsert: true }); return doc },
      async listNotes(id) { return (await notes.find({ studentId: id }).sort({ createdAt: -1 }).limit(100).toArray()).map(strip) },
      async addNote(n) { const doc = { ...n, createdAt: new Date() }; await notes.insertOne(doc); return strip(doc) },
      async listThreads(id) { return (await threads.find({ studentId: id }).toArray()).map(strip) },
      async saveThread(t) { const doc = { ...t, createdAt: new Date() }; await threads.insertOne(doc); return strip(doc) },
    }
  } catch (e) {
    console.warn('[pulse-student] Atlas unreachable, falling back to local JSON store:', e.message)
    return fileStore()
  }
}
