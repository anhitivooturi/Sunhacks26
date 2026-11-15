// Generates + validates /fixtures/{transcript,events,report}.json (deterministic).
// Run: node web/student/scripts/build-fixtures.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')
const SESSION_ID = 'demo-session'
const START = Date.parse('2026-11-14T15:00:00Z')

/* ---------- transcript: 8-minute recursion lecture ---------- */
const lines = [
  [0, "Good morning everyone. Today we're talking about recursion, one of the most useful and most misunderstood ideas in programming."],
  [14, "Here's the basic idea. A recursive function is a function that solves a problem by calling itself on a smaller version of the same problem."],
  [30, "Think about Russian nesting dolls. To find the smallest doll you open the big one, and inside is a slightly smaller doll, and you repeat the exact same action until there is nothing left to open."],
  [48, "Programming works the same way. Suppose I want the sum of the numbers from one to n. I can say the sum to n is n plus the sum to n minus one."],
  [66, "Notice that the right side of that sentence contains the same problem again, just with a smaller number. That's the recursive step."],
  [84, "Let's write it in Python. def total of n, and then we return n plus total of n minus one."],
  [102, "Now, who sees a problem here? If I call total of three, it calls total of two, which calls total of one, which calls total of zero, then total of negative one, and it never stops."],
  [120, "Good. So we need a way to stop. Let me show you a different example first, factorial, because it's the classic."],
  [138, "Factorial of n is n times factorial of n minus one. Factorial of five is five times factorial of four, and so on."],
  [156, "So obviously the function needs a base case, and once we hit it the stack unwinds and the return values multiply back up through the frames."],
  [176, "And that gives us one hundred twenty. Okay? So the answer just comes out of the bottom."],
  [192, "Next example: Fibonacci. Each number is the sum of the previous two. Fib of six is fib of five plus fib of four."],
  [212, "Let me draw the call tree. Fib of five splits into fib of four and fib of three, and each of those splits again, so the tree grows very quickly."],
  [232, "Count the work: fib of two gets computed three times in this tree. That's wasteful, and we'll fix it in a minute."],
  [252, "By the way, that thing I called the base case a moment ago is simply the input where we stop calling ourselves and return an answer directly. For factorial, that's factorial of one equals one."],
  [272, "Let's trace factorial of three slowly. Factorial of three asks for three times factorial of two. That pauses and asks factorial of two, which asks factorial of one."],
  [292, "Factorial of one hits the base case and returns one. Now factorial of two can finish: two times one is two. Then factorial of three finishes: three times two is six."],
  [312, "That's the call stack in action. Each paused call waits on a sticky note, a stack frame, and the newest note is always on top."],
  [332, "Here is the trick to fixing Fibonacci. Memoization means remembering answers we have already computed so we never repeat work."],
  [352, "We store each result in a dictionary keyed by n. Before computing, we check the dictionary; if the key is there we return it instantly."],
  [372, "That turns an exponential algorithm into a linear one, because each value is computed exactly once."],
  [392, "Common mistakes. One, forgetting the base case, which gives you infinite recursion and a stack overflow. Two, not shrinking the problem."],
  [412, "Three, a base case that the input can never reach, for example if you subtract two from an odd number but stop at zero."],
  [432, "Practice problem for the week: write a function that reverses a string recursively. Hint: the reverse of a string is the last letter plus the reverse of the rest."],
  [452, "To recap: recursion solves a problem by solving smaller copies of itself, every recursive function needs a base case, and memoization can save you from repeated work. See you on Thursday."],
]
const DURATION = 480
const chunks = lines.map(([startSec, text], i) => ({
  startSec,
  endSec: i + 1 < lines.length ? lines[i + 1][0] : DURATION,
  text,
}))
const passage = (a, b) => chunks.filter(c => c.startSec >= a && c.endSec <= b).map(c => c.text).join(' ')

/* ---------- events ---------- */
let seed = 20261114
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1))
const students = Array.from({ length: 20 }, (_, i) => `stu_${String(i + 1).padStart(2, '0')}`)
const shuffle = a => a.map(v => [rnd(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1])
const events = []
let eid = 1
const add = (studentId, type, t, payload = {}) =>
  events.push({ id: eid++, sessionId: SESSION_ID, studentId, type, transcriptTsSec: t, createdAt: new Date(START + t * 1000).toISOString(), payload })
// tap events: type === kind (contract kinds: lost | slow | fast | got_it)
const tap = (s, kind, t) => add(s, kind, t, { kind })

// calm "got it" taps outside spike zones
for (const s of students) for (let k = 0; k < ri(2, 4); k++) {
  const t = ri(15, 470); if ((t > 170 && t < 215) || (t > 368 && t < 398)) continue; tap(s, 'got_it', t)
}
for (const s of shuffle(students).slice(0, 2)) tap(s, 'fast', ri(30, 90))
// SPIKE 1: 14 distinct students lost right after the base-case passage (156-192)
const spike1 = shuffle(students).slice(0, 14)
spike1.forEach(s => tap(s, 'lost', ri(176, 198)))
shuffle(spike1).slice(0, 5).forEach(s => tap(s, 'slow', ri(180, 200)))
// SPIKE 2 (mild): memoization jump
shuffle(students).slice(0, 6).forEach(s => tap(s, 'lost', ri(375, 392)))
// sporadic noise
tap('stu_03', 'lost', 71); tap('stu_17', 'lost', 255); tap('stu_09', 'slow', 120)
// relief after the late definition
shuffle(students).slice(0, 6).forEach(s => tap(s, 'got_it', ri(262, 285)))

// questions + upvotes + host actions
const Q = [
  ['stu_04', 205, 'What exactly is a base case? You said it before explaining it.'],
  ['stu_11', 214, 'Where does the stack come from? Is that the same as a list?'],
  ['stu_02', 300, 'Why does factorial(2) have to wait for factorial(1)?'],
  ['stu_15', 380, 'Is memoization the same as caching?'],
  ['stu_08', 420, 'What happens if the input is negative?'],
  ['stu_19', 440, 'Can every loop be rewritten as recursion?'],
]
Q.forEach(([s, t, text], i) => add(s, 'question', t, { questionId: `q${i + 1}`, text }))
const ups = { q1: 9, q2: 6, q3: 3, q4: 4, q5: 1, q6: 2 }
for (const [qid, n] of Object.entries(ups)) shuffle(students).slice(0, n).forEach(s => add(s, 'upvote', 440 + ri(0, 30), { questionId: qid }))
add('host', 'mark_answered', 300, { questionId: 'q3' })
add('host', 'mark_answered', 305, { questionId: 'q2' })
add('host', 'push_fix', 482, { momentId: 'm1' })

// quiz answers after push_fix (verify step)
const quiz1 = [
  { q: 'What is the base case in a recursive function?', options: ['The first call the program makes', 'The input where the function stops calling itself and returns directly', 'The largest input the function accepts', 'The line that calls the function again'], answerIndex: 1, explanation: 'The base case is the simplest input; the function returns an answer there instead of recursing.' },
  { q: 'What happens if factorial has no base case?', options: ['It returns 0', 'It returns 1', 'It calls itself forever until the stack overflows', 'It loops once and stops'], answerIndex: 2, explanation: 'Without a stopping point every call makes another call, so frames pile up until the stack overflows.' },
  { q: 'In factorial(3), which call returns first?', options: ['factorial(3)', 'factorial(2)', 'factorial(1)', 'They return at the same time'], answerIndex: 2, explanation: 'factorial(1) hits the base case and returns 1; the paused calls then finish from the inside out.' },
]
const resolvers = shuffle(students).slice(0, 16)
const missRate = [0.15, 0.2, 0.25]
resolvers.forEach((s, i) => quiz1.forEach((q, qi) => {
  const correct = rnd() > missRate[qi]
  const choice = correct ? q.answerIndex : (q.answerIndex + ri(1, 3)) % 4
  add(s, 'quiz_answer', 485 + i * 2 + qi, { momentId: 'm1', qIndex: qi, choice, correct })
}))
events.sort((a, b) => a.transcriptTsSec - b.transcriptTsSec || a.id - b.id)
events.forEach((e, i) => (e.id = i + 1))

/* ---------- report (exact contract shape) ---------- */
const p1 = passage(156, 192), p2 = passage(352, 392)
const q1 = 'the function needs a base case, and once we hit it the stack unwinds'
const q2 = 'That turns an exponential algorithm into a linear one'
const quiz2 = [
  { q: 'What does memoization do?', options: ['Runs the function in parallel', "Remembers results of earlier calls so they aren't recomputed", 'Deletes the base case', 'Turns the function into a loop'], answerIndex: 1, explanation: 'It stores answers in a dictionary so repeated inputs are looked up instead of recalculated.' },
  { q: 'Before computing fib(n), a memoized function should…', options: ['check whether n is already in the dictionary', 'always recurse first', 'clear the dictionary', 'sort the inputs'], answerIndex: 0, explanation: 'The lookup comes first; only a miss triggers the real computation.' },
  { q: 'Why does memoization make fib run in linear time?', options: ['Each value is computed only once', 'It removes the base case', 'It uses fewer variables', 'The call tree gets taller'], answerIndex: 0, explanation: 'Every fib(k) is computed once and reused, so the work grows with n, not exponentially.' },
]
const understanding = (a, b) => {
  const r = events.filter(e => e.payload.kind && e.transcriptTsSec >= a && e.transcriptTsSec < b)
  return r.length ? +(r.filter(e => e.type === 'got_it').length / r.length).toFixed(2) : 0
}
const qCount = (a, b) => events.filter(e => e.type === 'question' && e.transcriptTsSec >= a && e.transcriptTsSec < b).length
const qa = events.filter(e => e.type === 'quiz_answer' && e.payload.momentId === 'm1')
const resolved1 = +(qa.filter(e => e.payload.correct).length / Math.max(1, qa.length)).toFixed(2)
const words = chunks.map(c => c.text.split(/\s+/).length).reduce((a, b) => a + b, 0)
const report = {
  sessionId: SESSION_ID,
  durationSec: DURATION,
  participants: 20,
  topics: [
    { start: 0, end: 138, title: 'Recursion Basics', confusion: 0.12, questions: qCount(0, 138), understanding: understanding(0, 138) },
    { start: 138, end: 332, title: 'Base Case and Stack', confusion: 0.62, questions: qCount(138, 332), understanding: understanding(138, 332) },
    { start: 332, end: 480, title: 'Memoization and Pitfalls', confusion: 0.27, questions: qCount(332, 480), understanding: understanding(332, 480) },
  ],
  moments: [
    {
      id: 'm1', startSec: 156, endSec: 192, score: 0.62, lostCount: 14, active: 20,
      passage: p1,
      whyConfusing: 'undefined_term',
      summary: '"Base case" and "stack unwinds" were used before either was defined, and the step from factorial(5) to 120 was skipped.',
      evidenceQuote: q1,
      reexplanation: 'A base case is the simplest input, where the function stops calling itself and just returns an answer. For factorial that is factorial(1) = 1; every bigger call waits on it, then multiplies its way back up.',
      example: 'factorial(3) needs factorial(2), which needs factorial(1) = 1 (base case, stop). Then 2 x 1 = 2, then 3 x 2 = 6.',
      quiz: quiz1,
      confidence: 'high', resolved: resolved1, quizAnswered: new Set(qa.map(e => e.studentId)).size, // PROPOSED optional fields
    },
    {
      id: 'm2', startSec: 352, endSec: 392, score: 0.31, lostCount: 6, active: 20,
      passage: p2,
      whyConfusing: 'no_example',
      summary: 'The jump from "store results in a dictionary" to "exponential becomes linear" came with no worked example.',
      evidenceQuote: q2,
      reexplanation: 'Memoization saves each answer the first time you compute it, so later calls just look it up. Fibonacci stops recomputing the same values, so the work grows with n instead of exploding.',
      example: 'fib(2) appears 3 times in the fib(5) tree. With memoization it is computed once, stored, and the other 2 times it is a dictionary lookup.',
      quiz: quiz2,
      confidence: 'medium', resolved: 0, quizAnswered: 0,
    },
  ],
  unanswered: [
    { id: 'q1', text: Q[0][2], upvotes: ups.q1 },
    { id: 'q4', text: Q[3][2], upvotes: ups.q4 },
    { id: 'q6', text: Q[5][2], upvotes: ups.q6 },
  ],
  deliveryStats: { wordsPerMinute: Math.round((words / DURATION) * 60), longestStretchWithoutExampleSec: 108, jargonBeforeDefinition: ['base case', 'stack unwinds', 'stack frame'] }, // PROPOSED optional
  recap: "Last class I used the words base case and stack before I defined them, and 14 of you told me you were lost. Here is the fix: a base case is the input where a recursive function stops calling itself and returns an answer. For factorial that is factorial of one. Every bigger call waits for it, then multiplies back up. We also moved quickly through memoization, so we will redo fib with a dictionary on the board. Still open from your questions: what a base case is exactly, whether memoization is just caching, and whether every loop can become recursion.",
}

/* ---------- validate ---------- */
const fail = m => { console.error('FIXTURE INVALID:', m); process.exit(1) }
chunks.forEach((c, i) => { if (i && c.startSec !== chunks[i - 1].endSec) fail('gap in transcript at ' + c.startSec) })
for (const m of report.moments) {
  if (!m.passage.includes(m.evidenceQuote)) fail(`quote not exact for ${m.id}`)
  if (m.evidenceQuote.split(/\s+/).length > 25) fail(`quote >25 words for ${m.id}`)
  if (m.quiz.length !== 3 || m.quiz.some(q => q.options.length !== 4)) fail('quiz shape ' + m.id)
}
const lostIn = (a, b) => new Set(events.filter(e => e.type === 'lost' && e.transcriptTsSec >= a && e.transcriptTsSec <= b).map(e => e.studentId)).size
if (lostIn(176, 198) < 14) fail('spike 1 too small')
if (new Set(events.filter(e => e.payload.kind).map(e => e.studentId)).size < 20) fail('need 20 distinct tappers')
if (report.topics.reduce((a, t) => a + (t.end - t.start), 0) !== DURATION) fail('topics must cover lecture')

const w = (n, d) => writeFileSync(join(OUT, n), JSON.stringify(d, null, 2) + '\n')
w('transcript.json', chunks); w('events.json', events); w('report.json', report)
console.log(`ok: ${chunks.length} chunks, ${events.length} events, lost spike1=${lostIn(176, 198)} spike2=${lostIn(375, 392)}`)
