import { z } from 'zod';
const text = z.string().trim().min(1).max(6000);
export const reasons = ['undefined_term', 'skipped_step', 'too_fast', 'no_example', 'assumed_prior_knowledge'];
export const schemas = {
  splitTopics: z.array(z.object({ start: z.number().nonnegative(), end: z.number().nonnegative(), title: text })).min(1).max(8),
  explainMoment: z.object({ whyConfusing: z.enum(reasons), evidenceQuote: z.string().max(1000), oneLineSummary: text }),
  generateFix: z.object({ reexplanation: text, example: text, quiz: z.array(z.object({ q: text, options: z.array(text).length(4), answerIndex: z.number().int().min(0).max(3), explanation: text })).length(3) }),
  generateRecap: z.object({ recap: text }),
};
export const noteSchemas = {
  flashcards: z.object({ content: z.array(z.object({ front: text, back: text })).min(2).max(3) }),
  diagram: z.object({ content: text }),
  bullets: z.object({ content: z.array(text).min(1).max(5) }),
  plain: z.object({ content: text }),
};
export const jsonSchema = schema => z.toJSONSchema(schema, { target: 'draft-7' });
