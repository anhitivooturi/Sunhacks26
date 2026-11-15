// Quick check of the Gemini functions against the shared demo lecture (fixtures/transcript.json).
// Run from the repo root:  node --env-file=server/live/.env server/ai/try.mjs
import { readFile } from 'node:fs/promises';
import { splitTopics, explainMoment, generateFix, generateRecap, computeDeliveryStats } from './index.js';

const chunks = JSON.parse(await readFile(new URL('../../fixtures/transcript.json', import.meta.url), 'utf8'));
const t0 = Date.now();
const time = (label) => console.log(`${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

const topics = await splitTopics(chunks);
time('splitTopics');
console.log(topics);

// The fixture's confusing passage: 156-192 s.
const startSec = 156, endSec = 192;
const passage = chunks.filter((c) => c.endSec > startSec && c.startSec <= endSec).map((c) => c.text).join(' ');
const ctx = { passage, startSec, endSec, transcriptChunks: chunks };
const [explain, fix] = await Promise.all([explainMoment(ctx), generateFix(ctx)]);
time('explainMoment + generateFix');
console.log(explain);
console.log(JSON.stringify(fix, null, 2));

const recap = await generateRecap(topics, [{ ...explain, ...fix, startSec, passage }], [{ text: 'What exactly is a base case?' }]);
time('generateRecap');
console.log(recap);
console.log(computeDeliveryStats(chunks));
