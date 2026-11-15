// Contract: react kinds are lost | slow | fast | got_it.
export const KINDS = [
  { id: 'lost',   label: 'Lost',      hint: 'wait, what?!', color: '#ff5a47' },
  { id: 'slow',   label: 'Slow down', hint: 'too fast',     color: '#ff9f1c' },
  { id: 'fast',   label: 'Speed up',  hint: 'too slow',     color: '#4cc2ff' },
  { id: 'got_it', label: 'Got it',    hint: 'ohh, I see',   color: '#3ddc97' },
]
export const COOLDOWN_MS = 3000
// Contract: whyConfusing is one of these codes. A one-line summary (PROPOSED optional field) may sit beside it.
export const REASONS = {
  undefined_term: 'Undefined term',
  skipped_step: 'Skipped step',
  too_fast: 'Too fast',
  no_example: 'No example',
  assumed_prior_knowledge: 'Assumed prior knowledge',
}
const REASON_HELP = {
  undefined_term: 'A key term was used before it was explained.',
  skipped_step: 'A step in the reasoning was skipped.',
  too_fast: 'This part went by faster than most people could follow.',
  no_example: 'The idea was stated without a worked example.',
  assumed_prior_knowledge: 'This leaned on background knowledge many students may not have yet.',
}
export function parseReason(moment = {}) {
  const raw = typeof moment === 'string' ? moment : moment.whyConfusing || ''
  const code = REASONS[raw] ? raw : Object.keys(REASONS).find(k => raw.includes(k)) || null
  const legacy = raw.replace(/^[a-z_]+:\s*/, '')   // tolerate "code: sentence" too
  return { code, label: code ? REASONS[code] : 'Confusing passage', text: (typeof moment === 'object' && moment.summary) || (legacy !== raw ? legacy : '') || (code ? REASON_HELP[code] : '') }
}
// honest numbers: label by how many students actually participated (used when the report has no confidence field)
export const confidenceFor = n => (n >= 15 ? 'high' : n >= 8 ? 'medium' : 'low')
