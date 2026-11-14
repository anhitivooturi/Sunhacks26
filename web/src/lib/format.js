export const fmtTime = (sec = 0) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);

export const WHY_LABELS = {
  undefined_term: { label: 'Undefined term', hint: 'A word was used before it was explained.' },
  skipped_step: { label: 'Skipped step', hint: 'A step in the reasoning was left out.' },
  too_fast: { label: 'Too fast', hint: 'The pace outran the class.' },
  no_example: { label: 'No example', hint: 'The idea stayed abstract with nothing concrete.' },
  assumed_prior_knowledge: { label: 'Assumed prior knowledge', hint: 'It relied on something students had not learned yet.' },
};

// Confidence from the number of distinct participants, used when the server doesn't send one.
export const confidenceFor = (moment, participants) => {
  if (moment?.confidence) return moment.confidence;
  const n = moment?.active ?? participants ?? 0;
  return n >= 15 ? 'high' : n >= 6 ? 'medium' : 'low';
};

// Green → amber → red, calm colors for a projector.
export const heat = (score = 0) => {
  if (score >= 0.35) return { bar: 'bg-rose-500', text: 'text-rose-500', soft: 'bg-rose-500/15' };
  if (score >= 0.15) return { bar: 'bg-amber-400', text: 'text-amber-500', soft: 'bg-amber-400/15' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-500', soft: 'bg-emerald-500/15' };
};
