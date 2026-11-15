import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createAI, computeDeliveryStats } from '../index.js';
const live = process.argv.includes('--live');
if (live && !process.env.GEMINI_API_KEY) { console.error('Set GEMINI_API_KEY in server/live/.env first.'); process.exit(1); }
const outputs = {};
let failed = false;
const logger = { info(data) { console.log(JSON.stringify(data)); if (live && data.source !== 'gemini') failed = true; }, warn(data) { console.warn(JSON.stringify(data)); } };
const ai = createAI({ ...(live ? {} : { apiKey: '' }), logger, cache: false, fixtureCache: false });
const transcript = JSON.parse(await readFile(new URL('../../../fixtures/transcript.json', import.meta.url), 'utf8'));
const report = JSON.parse(await readFile(new URL('../../../fixtures/report.json', import.meta.url), 'utf8'));
async function save(name, input, run) { const value = await run(); outputs[ai.keyFor(name, input)] = value; return value; }
const topicInput = { transcriptChunks: transcript, durationSec: transcript.at(-1).endSec };
const topics = await save('splitTopics', topicInput, () => ai.splitTopics(transcript));
const moments = [];
for (const moment of report.moments) {
  const context = { passage: moment.passage, startSec: moment.startSec, endSec: moment.endSec, transcriptChunks: transcript };
  const explanation = await save('explainMoment', context, () => ai.explainMoment(context));
  const fix = await save('generateFix', context, () => ai.generateFix(context));
  moments.push({ ...moment, ...explanation, ...fix });
}
const recapInput = { topics, moments, unansweredQuestions: report.unanswered };
await save('generateRecap', recapInput, async () => ({ recap: await ai.generateRecap(topics, moments, report.unanswered) }));
for (const format of ['flashcards', 'diagram', 'bullets', 'plain']) await save('generateNotes', { passage: report.moments[0].passage, format }, () => ai.generateNotes(report.moments[0].passage, format));
console.log(JSON.stringify({ provider: live ? 'gemini' : 'offline', stats: computeDeliveryStats(transcript), calls: Object.keys(outputs).length, allLiveCallsSucceeded: live ? !failed : null }));
if (process.argv.includes('--write-cache') && !failed) { await mkdir(new URL('../.cache/', import.meta.url), { recursive: true }); await writeFile(new URL('../.cache/demo.json', import.meta.url), JSON.stringify(outputs)); console.log('Demo cache saved (ignored by Git).'); }
if (failed) process.exitCode = 1;
