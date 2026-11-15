// localStorage that never throws (private mode, blocked storage, etc.)
export const store = {
  get(key, fallback = null) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v) } catch { return fallback } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* ignore */ } },
}
export function getStudentId() {
  let id = store.get('pulse.studentId')
  if (!id) { id = 'stu_' + Math.random().toString(36).slice(2, 10); store.set('pulse.studentId', id) }
  return id
}
// Lost/any taps kept locally so the review page can find "where I was lost".
// `at` is the last transcript startSec the client saw (display only; never sent to the server).
export function recordTap(code, kind, at) {
  const taps = store.get('pulse.taps', [])
  taps.push({ code, kind, at, wall: Date.now() })
  store.set('pulse.taps', taps.slice(-300))
}
export const getTaps = () => store.get('pulse.taps', [])
export const saveQuizResult = (momentId, results) => store.set('pulse.quiz.' + momentId, results)
export const getQuizResult = momentId => store.get('pulse.quiz.' + momentId, null)
export function myAskedQuestions(code) { return store.get('pulse.asked.' + code, []) }
export function rememberAsked(code, text) { store.set('pulse.asked.' + code, [...myAskedQuestions(code), { text, wall: Date.now() }].slice(-30)) }
