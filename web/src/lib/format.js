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

// Same colors as the student tap buttons (Got it / Slow down / Lost), so a professor sees the color
// students pressed. Fills use the student tokens; text uses darker shades for contrast on white.
// Every color also comes with a word (label) so status never relies on color alone.
export const heat = (score = 0) => {
  if (score >= 0.35)
    return { bar: 'bg-lost', text: 'text-red-600 dark:text-[#ff7a6a]', soft: 'bg-lost/15', border: 'border-lost/50', label: 'Lost' };
  if (score >= 0.15)
    return { bar: 'bg-slow', text: 'text-amber-600 dark:text-[#ffb54d]', soft: 'bg-slow/15', border: 'border-slow/50', label: 'Some confusion' };
  return { bar: 'bg-got', text: 'text-emerald-600 dark:text-[#3ddc97]', soft: 'bg-got/15', border: 'border-got/40', label: 'Clear' };
};
