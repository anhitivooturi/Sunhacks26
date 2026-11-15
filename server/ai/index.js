import dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schemas, noteSchemas, jsonSchema } from './schemas.js';
import { prompts } from './prompts.js';
import { fallbacks } from './fallbacks.js';
export { computeDeliveryStats } from './delivery-stats.js';
dotenv.config({ path: fileURLToPath(new URL('../live/.env', import.meta.url)), quiet: true });
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)), quiet: true });

export function createAI({ apiKey = process.env.AI_OFFLINE === '1' ? '' : process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite', fetch: request = globalThis.fetch, logger = console,
  timeoutMs = 18000, cache = true, fixtureCache = true } = {}) {
  const cached = new Map();
  if (fixtureCache) {
    try { for (const [key, value] of Object.entries(JSON.parse(readFileSync(new URL('./.cache/demo.json', import.meta.url), 'utf8')))) cached.set(key, value); } catch { /* optional pre-generated demo cache */ }
  }
  const keyFor = (name, input) => createHash('sha256').update(JSON.stringify({ model, name, input })).digest('hex');
  async function call(name, input, schema, backup, validate = value => value) {
    const key = keyFor(name, input);
    if (cache && cached.has(key)) return structuredClone(await cached.get(key));
    const run = async () => {
      const start = performance.now();
      const controller = new AbortController();
      let timer, source = 'fallback';
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('AI deadline exceeded')); }, Math.min(19000, Math.max(1, timeoutMs))); });
      try {
        if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
        let correction = '', lastError = '';
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const operation = (async () => {
              const inputForModel = input?.transcriptChunks && Number.isFinite(input.startSec) ? { ...input,
                transcriptChunks: input.transcriptChunks.filter(c => c.endSec > input.startSec - 60 && c.startSec < input.endSec + 60) } : input;
              let response;
              // Preserve the team's model fallback for 429/503 responses, inside the whole-call deadline.
              for (const candidate of [...new Set([model, 'gemini-flash-lite-latest', 'gemini-flash-latest'])]) {
              try {
              response = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
                body: JSON.stringify({ systemInstruction: { parts: [{ text: prompts[name] }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(inputForModel) + correction }] }],
                  generationConfig: { temperature: 0.25, responseMimeType: 'application/json', responseJsonSchema: jsonSchema(schema), maxOutputTokens: 4096 } }),
              });
              } catch (error) { if (!controller.signal.aborted && error.name === 'TimeoutError') continue; throw error; }
              if (response.ok || ![429, 503].includes(response.status)) break;
              }
              if (!response) throw new Error('Gemini models did not respond');
              if (!response.ok) throw Object.assign(new Error(`Gemini HTTP ${response.status}`), { status: response.status });
              const body = await response.json();
              const text = body.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('');
              return validate(schema.parse(JSON.parse(text)));
            })();
            const result = await Promise.race([operation, deadline]);
            source = 'gemini'; return result;
          } catch (error) {
            if (controller.signal.aborted || error.status) throw error;
            lastError = String(error.message).slice(0, 300);
            correction = `\nYour previous output failed validation: ${String(error.message).slice(0, 1200)}. Correct it and return JSON only.`;
          }
        }
        throw new Error(`AI output failed validation twice: ${lastError}`);
      } catch (error) {
        logger.warn?.({ function: name, reason: controller.signal.aborted ? 'timeout' : apiKey ? 'provider_or_validation_error' : 'missing_key', detail: error.message.slice(0, 350) }, 'AI backup used');
        return backup();
      } finally {
        clearTimeout(timer); controller.abort();
        logger.info?.({ function: name, source, latencyMs: Math.round(performance.now() - start) }, 'AI call');
      }
    };
    const pending = run();
    if (cache) { if (cached.size >= 100) cached.delete(cached.keys().next().value); cached.set(key, pending); }
    return structuredClone(await pending);
  }
  return {
    keyFor,
    async splitTopics(chunks, { durationSec = chunks.length ? Math.max(...chunks.map(c => c.endSec)) : 0 } = {}) {
      if (!chunks.length || !durationSec) return [];
      return call('splitTopics', { transcriptChunks: chunks, durationSec }, schemas.splitTopics, () => fallbacks.splitTopics(chunks, durationSec), topics => {
        let end = 0;
        for (const t of topics) {
          if (Math.abs(t.start - end) > 0.01 || t.end <= t.start || t.title.split(/\s+/).length < 2 || t.title.split(/\s+/).length > 5) throw new Error('Topics must be contiguous with short titles');
          end = t.end;
        }
        if (Math.abs(end - durationSec) > 0.01) throw new Error('Topics must cover the full lecture');
        return topics;
      });
    },
    explainMoment(context) {
      const passage = typeof context === 'string' ? context : context.passage || '';
      let invalidQuote;
      return call('explainMoment', context, schemas.explainMoment, () => invalidQuote ? { ...invalidQuote, evidenceQuote: '' } : fallbacks.explainMoment(context), value => {
        if (!value.evidenceQuote || !passage.includes(value.evidenceQuote) || value.evidenceQuote.trim().split(/\s+/).length > 25) { invalidQuote = value; throw new Error('evidenceQuote must be an exact substring of passage, at most 25 words'); }
        return value;
      });
    },
    generateFix(context) {
      return call('generateFix', context, schemas.generateFix, () => fallbacks.generateFix(context), value => {
        if ((value.reexplanation.match(/[.!?](?:\s|$)/g)?.length || 1) > 2) throw new Error('Reexplanation must be at most two sentences');
        if (value.quiz.some(q => new Set(q.options).size !== 4)) throw new Error('Quiz options must be distinct');
        return value;
      });
    },
    async generateRecap(topics, moments, unansweredQuestions) {
      const out = await call('generateRecap', { topics, moments, unansweredQuestions }, schemas.generateRecap,
        () => ({ recap: fallbacks.generateRecap(topics, moments, unansweredQuestions) }), value => {
          if (value.recap.split(/\s+/).length > 120) throw new Error('Recap must be at most 120 words'); return value;
        });
      return out.recap;
    },
    async generateNotes(passage, format = 'plain') {
      if (!Object.hasOwn(noteSchemas, format)) throw new Error('Unknown notes format');
      const out = await call('generateNotes', { passage, format }, noteSchemas[format], () => fallbacks.generateNotes(passage, format), value => {
        if (format === 'diagram') {
          const lines = value.content.trim().split('\n');
          const node = '[A-Za-z][A-Za-z0-9_]*(?:\\["[^"\\[\\]<>`]*"\\])?';
          const edge = new RegExp(`^\\s*${node}(?:\\s*-->\\s*${node})*\\s*;?\\s*$`);
          if (!/^flowchart (TD|LR)$/.test(lines[0]) || lines.length < 2 || lines.length > 12 || !lines.slice(1).every(line => edge.test(line))) throw new Error('Use flowchart TD, a newline, then simple edges like A["Idea"] --> B["Next step"] without HTML or styling');
        }
        return value;
      });
      return { format, content: out.content };
    },
  };
}
const ai = createAI();
export const { splitTopics, explainMoment, generateFix, generateRecap, generateNotes } = ai;
