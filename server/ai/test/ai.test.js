import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAI, computeDeliveryStats } from '../index.js';
const transcript = JSON.parse(readFileSync(new URL('../../../fixtures/transcript.json', import.meta.url), 'utf8'));
const report = JSON.parse(readFileSync(new URL('../../../fixtures/report.json', import.meta.url), 'utf8'));
const logger = { info() {}, warn() {} };
const options = { apiKey: 'test-key', logger, cache: false, fixtureCache: false };
const response = value => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: typeof value === 'string' ? value : JSON.stringify(value) }] } }] }) });

test('missing key produces all fixture-compatible outputs and grounded notes', async () => {
  const ai = createAI({ ...options, apiKey: '' });
  const topics = await ai.splitTopics(transcript);
  assert.equal(topics[0].start, 0); assert.equal(topics.at(-1).end, transcript.at(-1).endSec);
  for (const m of report.moments) {
    const explanation = await ai.explainMoment(m);
    assert.ok(m.passage.includes(explanation.evidenceQuote));
    const fix = await ai.generateFix(m);
    assert.equal(fix.quiz.length, 3); assert.ok(fix.quiz.every(q => q.options.length === 4));
  }
  assert.equal(typeof await ai.generateRecap(topics, report.moments, report.unanswered), 'string');
  for (const format of ['flashcards', 'diagram', 'bullets', 'plain']) assert.ok((await ai.generateNotes('A neuron sends signals.', format)).content);
  assert.ok(!(await ai.generateNotes('A neuron sends signals.', 'plain')).content.includes('recursion'));
});
test('invalid JSON retries exactly once with validation feedback and a response schema', async () => {
  const requests = [];
  const ai = createAI({ ...options, fetch: async (_url, request) => { requests.push(JSON.parse(request.body)); return response(requests.length === 1 ? 'invalid JSON' : { recap: 'I will revisit the base case.' }); } });
  assert.equal(await ai.generateRecap([], [], []), 'I will revisit the base case.');
  assert.equal(requests.length, 2);
  assert.match(requests[1].contents[0].parts[0].text, /failed validation/);
  assert.equal(requests[0].generationConfig.temperature, 0.25);
  assert.equal(requests[0].generationConfig.responseMimeType, 'application/json');
  assert.ok(requests[0].generationConfig.responseJsonSchema.properties.recap);
});
test('fabricated evidence is retried then dropped; a corrected quote is retained', async () => {
  const value = { whyConfusing: 'undefined_term', evidenceQuote: 'Invented sentence', oneLineSummary: 'An undefined term appeared.' };
  let calls = 0;
  const ai = createAI({ ...options, fetch: async () => { calls++; return response(value); } });
  assert.equal((await ai.explainMoment({ passage: 'An actual passage.' })).evidenceQuote, ''); assert.equal(calls, 2);
  calls = 0;
  const corrected = createAI({ ...options, fetch: async () => response({ ...value, evidenceQuote: ++calls === 1 ? 'Invented sentence' : 'actual passage' }) });
  assert.equal((await corrected.explainMoment({ passage: 'An actual passage.' })).evidenceQuote, 'actual passage');
});
test('teammate model failover survives 429/503 responses within the deadline', async () => {
  const urls = [];
  const ai = createAI({ ...options, fetch: async url => { urls.push(url); return urls.length === 1 ? { ok: false, status: 503 } : response({ recap: 'I will review the lecture.' }); } });
  assert.equal(await ai.generateRecap([], [], []), 'I will review the lecture.');
  assert.equal(urls.length, 2); assert.match(urls[1], /gemini-flash-lite-latest/);
});
test('overlapping topics and malformed quizzes use backups', async () => {
  let calls = 0;
  const ai = createAI({ ...options, fetch: async () => { calls++; return response([{ start: 0, end: 10, title: 'First topic' }, { start: 9, end: 20, title: 'Second topic' }]); } });
  const topics = await ai.splitTopics([{ startSec: 0, endSec: 20, text: 'An idea.' }]);
  assert.equal(calls, 2); assert.equal(topics.at(-1).end, 20);
  const invalidQuiz = createAI({ ...options, fetch: async () => response({ reexplanation: 'Some text.', example: 'One example.', quiz: [] }) });
  assert.equal((await invalidQuiz.generateFix(report.moments[0])).quiz.length, 3);
});
test('stalled providers respect the whole-call deadline and duplicate calls share a cache', async () => {
  const ai = createAI({ ...options, timeoutMs: 25, fetch: () => new Promise(() => {}) });
  const start = Date.now();
  assert.equal(typeof await ai.generateRecap([], [], []), 'string');
  assert.ok(Date.now() - start < 250);
  let calls = 0;
  const cached = createAI({ ...options, cache: true, fetch: async () => { calls++; return response({ recap: 'I will review.' }); } });
  await Promise.all([cached.generateRecap([], [], []), cached.generateRecap([], [], [])]);
  assert.equal(calls, 1);
});
test('delivery statistics use transcript times and example/definition cues', () => {
  const stats = computeDeliveryStats([{ startSec: 0, endSec: 10, text: 'We use a continuation now.' }, { startSec: 10, endSec: 20, text: 'For example, trace one call.' }, { startSec: 20, endSec: 30, text: 'A continuation is the next step.' }]);
  assert.equal(stats.wordsPerMinute, 32); assert.equal(stats.longestStretchWithoutExampleSec, 10);
  assert.deepEqual(stats.jargonBeforeDefinition, ['continuation']);
  assert.deepEqual(computeDeliveryStats([]), { wordsPerMinute: 0, longestStretchWithoutExampleSec: 0, jargonBeforeDefinition: [] });
});
