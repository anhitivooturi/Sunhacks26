// Gemini functions for Wait, what? (server/ai). Loaded automatically by server/live/src/ai-adapter.js,
// which adds the 20 s timeout, output validation and fixture fallbacks. Every function here returns
// exactly the shapes the adapter and docs/contract.md expect, or throws so the adapter can fall back.
//
// Env (read from server/live/.env by the server): GEMINI_API_KEY (required), GEMINI_MODEL (optional).
// Plain fetch to the Gemini REST API: no extra dependencies.

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const REASONS = ['undefined_term', 'skipped_step', 'too_fast', 'no_example', 'assumed_prior_knowledge'];

const model = () => process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
// When a model is overloaded (503) or rate-limited (429), try the next one. All within the server's 20 s cap.
const models = () => [...new Set([model(), 'gemini-flash-lite-latest', 'gemini-flash-latest'])];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(key, body) {
  let last;
  for (const m of models()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${API}/${m}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return res.json();
      last = `Gemini ${m} ${res.status}: ${(await res.text()).slice(0, 160)}`;
      if (res.status !== 503 && res.status !== 429) throw new Error(last);
      if (attempt === 0) await sleep(800);
    }
  }
  throw new Error(last);
}

// One Gemini call in JSON mode with a response schema. Retries once with the validation error appended.
async function gemini({ system, prompt, schema, validate, temperature = 0.25 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set in server/live/.env');
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = attempt === 0 ? prompt : `${prompt}\n\nYour previous answer was invalid: ${lastError}. Return valid JSON only.`;
    const data = await call(key, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
    });
    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    try {
      const value = JSON.parse(raw);
      const problem = validate(value);
      if (!problem) return value;
      lastError = problem;
    } catch (e) {
      lastError = `not JSON (${e.message})`;
    }
  }
  throw new Error(`Gemini output invalid after retry: ${lastError}`);
}

const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const timed = (chunks) => chunks.map((c) => `[${Math.round(c.startSec)}-${Math.round(c.endSec)}] ${c.text}`).join('\n');
// A little context around the passage helps the model judge "used before it was defined".
const around = (ctx, pad = 60) =>
  timed((ctx.transcriptChunks || []).filter((c) => c.endSec > ctx.startSec - pad && c.startSec < ctx.endSec + pad));

// ---------- splitTopics(transcriptChunks) -> [{ start, end, title }] ----------
export async function splitTopics(chunks) {
  if (!chunks?.length) return [];
  const end = chunks[chunks.length - 1].endSec;
  const out = await gemini({
    system:
      'You are analyzing a lecture transcript with timestamps in seconds. Split it into 3 to 8 contiguous topics that cover the whole lecture with no gaps. Give each a short title of 2 to 5 words and its start and end time in seconds. Use only what is said in the transcript. Return JSON only.',
    prompt: `Transcript (lecture runs 0 to ${Math.round(end)} seconds):\n${timed(chunks)}`,
    schema: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { start: { type: 'NUMBER' }, end: { type: 'NUMBER' }, title: { type: 'STRING' } }, required: ['start', 'end', 'title'] },
    },
    validate: (v) => (Array.isArray(v) && v.length >= 1 && v.every((t) => Number.isFinite(t.start) && Number.isFinite(t.end) && t.title?.trim()) ? null : 'need [{start,end,title}]'),
  });
  // Make topics contiguous from 0 to the end of the transcript, the way the report requires.
  // Each topic starts where the previous one ended; the last one ends at the end of the transcript.
  const sorted = out.sort((a, b) => a.start - b.start);
  const topics = [];
  sorted.forEach((t, i) => {
    const start = topics.length ? topics[topics.length - 1].end : 0;
    const stop = i === sorted.length - 1 ? end : Math.min(end, t.end);
    if (stop > start) topics.push({ start, end: stop, title: t.title.trim().slice(0, 60) });
  });
  if (topics.length) topics[topics.length - 1].end = end;
  return topics;
}

// ---------- explainMoment(context) -> { whyConfusing, evidenceQuote, oneLineSummary } ----------
export async function explainMoment(ctx) {
  if (!ctx?.passage?.trim()) return { whyConfusing: 'skipped_step', evidenceQuote: '', oneLineSummary: '' };
  const out = await gemini({
    system:
      `You are a teaching coach. Students signaled confusion during this passage of a lecture. Choose the single best reason from this list: ${REASONS.join(', ')}. Then give an evidenceQuote copied EXACTLY, word for word, from the passage, with at most 25 words, and a oneLineSummary in plain language saying what likely confused students. Never invent content that is not in the passage. Return JSON only.`,
    prompt: `Passage where students got lost (${fmt(ctx.startSec)}–${fmt(ctx.endSec)}):\n"""${ctx.passage}"""\n\nSurrounding lecture for context:\n${around(ctx)}`,
    schema: {
      type: 'OBJECT',
      properties: { whyConfusing: { type: 'STRING', enum: REASONS }, evidenceQuote: { type: 'STRING' }, oneLineSummary: { type: 'STRING' } },
      required: ['whyConfusing', 'evidenceQuote', 'oneLineSummary'],
    },
    validate: (v) => {
      if (!REASONS.includes(v?.whyConfusing)) return 'whyConfusing must be one of the listed reasons';
      if (typeof v.evidenceQuote !== 'string' || !ctx.passage.includes(v.evidenceQuote)) return 'evidenceQuote must be an exact substring of the passage';
      if (v.evidenceQuote.split(/\s+/).length > 25) return 'evidenceQuote must be 25 words or fewer';
      return null;
    },
    temperature: 0.2,
  }).catch((e) => {
    // Quote couldn't be verified even after a retry: keep the reason, drop the quote rather than invent one.
    if (/evidenceQuote/.test(e.message)) return { whyConfusing: 'skipped_step', evidenceQuote: '', oneLineSummary: '' };
    throw e;
  });
  return out;
}

// ---------- generateFix(context) -> { reexplanation, example, quiz: [3 x { q, options[4], answerIndex, explanation }] } ----------
export async function generateFix(ctx) {
  if (!ctx?.passage?.trim()) throw new Error('No passage to fix'); // adapter falls back
  return gemini({
    system:
      'You are a patient teaching assistant. Using ONLY ideas that appear in this lecture passage and its context, write: a reexplanation of at most 2 sentences, one concrete example, and exactly 3 multiple-choice check questions with 4 options each, the correct answerIndex (0-3), and a one-sentence explanation. All 3 questions must test the idea in the passage where students got lost (not other parts of the lecture, not trivia). Vary which option is correct. Return JSON only.',
    prompt: `Passage where students got lost:\n"""${ctx.passage}"""\n\nSurrounding lecture for context:\n${around(ctx)}`,
    schema: {
      type: 'OBJECT',
      properties: {
        reexplanation: { type: 'STRING' },
        example: { type: 'STRING' },
        quiz: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: { q: { type: 'STRING' }, options: { type: 'ARRAY', items: { type: 'STRING' } }, answerIndex: { type: 'INTEGER' }, explanation: { type: 'STRING' } },
            required: ['q', 'options', 'answerIndex', 'explanation'],
          },
        },
      },
      required: ['reexplanation', 'example', 'quiz'],
    },
    validate: (v) => {
      if (!v?.reexplanation || !v?.example) return 'reexplanation and example are required';
      if (!Array.isArray(v.quiz) || v.quiz.length !== 3) return 'quiz must have exactly 3 questions';
      const bad = v.quiz.find((q) => !q.q || !Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3 || !q.explanation);
      return bad ? 'each question needs q, 4 options, answerIndex 0-3 and explanation' : null;
    },
  });
}

// ---------- generateRecap(topics, moments, unanswered) -> string ----------
export async function generateRecap(topics, moments, unanswered) {
  const out = await gemini({
    system:
      'Write a recap a professor could read in under 60 seconds at the start of next class. Cover the confusing moments and unanswered questions listed below. Use plain language, at most 120 words, in first person as the professor. Return JSON: {"recap": "..."}',
    prompt: JSON.stringify({
      topics: (topics || []).map((t) => t.title),
      confusingMoments: (moments || []).map((m) => ({ at: fmt(m.startSec), reason: m.whyConfusing, said: m.evidenceQuote || m.passage?.slice(0, 200), fix: m.reexplanation })),
      unansweredQuestions: (unanswered || []).slice(0, 5).map((q) => q.text),
    }),
    schema: { type: 'OBJECT', properties: { recap: { type: 'STRING' } }, required: ['recap'] },
    validate: (v) => (typeof v?.recap === 'string' && v.recap.trim() ? null : 'recap string required'),
    temperature: 0.3,
  });
  return out.recap.trim();
}

// ---------- computeDeliveryStats(transcriptChunks) -> computed in code, not by Gemini ----------
export function computeDeliveryStats(chunks = []) {
  if (!chunks.length) return { wordsPerMinute: 0, longestStretchWithoutExampleSec: 0, jargonBeforeDefinition: [] };
  const words = chunks.reduce((n, c) => n + c.text.split(/\s+/).filter(Boolean).length, 0);
  const minutes = Math.max(1 / 60, (chunks[chunks.length - 1].endSec - chunks[0].startSec) / 60);
  let last = chunks[0].startSec;
  let longest = 0;
  chunks.forEach((c) => {
    if (/\b(for example|for instance|e\.g\.|like this|say we|imagine|let's say)\b/i.test(c.text)) {
      longest = Math.max(longest, c.startSec - last);
      last = c.endSec;
    }
  });
  longest = Math.max(longest, chunks[chunks.length - 1].endSec - last);
  return { wordsPerMinute: Math.round(words / minutes), longestStretchWithoutExampleSec: Math.round(longest), jargonBeforeDefinition: [] };
}
