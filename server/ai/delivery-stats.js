// Transparent transcript heuristics, not measurements of the speaker's intent.
export function computeDeliveryStats(chunks = []) {
  const sorted = chunks.filter(c => Number.isFinite(c.startSec) && Number.isFinite(c.endSec) && c.endSec >= c.startSec).toSorted((a, b) => a.startSec - b.startSec);
  if (!sorted.length) return { wordsPerMinute: 0, longestStretchWithoutExampleSec: 0, jargonBeforeDefinition: [] };
  const end = Math.max(...sorted.map(c => c.endSec));
  const start = Math.min(...sorted.map(c => c.startSec));
  const text = sorted.map(c => c.text).join(' ');
  const words = text.match(/\b[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length || 0;
  let anchor = start, longest = 0;
  for (const c of sorted) {
    if (/\b(for example|for instance|suppose|imagine|such as|like this|say we|let's say|e\.g\.)\b/i.test(c.text)) {
      longest = Math.max(longest, c.startSec - anchor);
      anchor = c.endSec;
    }
  }
  longest = Math.max(longest, end - anchor);
  const lower = text.toLowerCase();
  const jargonBeforeDefinition = ['recursion', 'base case', 'stack frame', 'continuation', 'recurrence', 'memoization', 'tail recursion'].filter(term => {
    const first = lower.indexOf(term);
    if (first < 0) return false;
    const definition = new RegExp(`(?:\\b${term}\\s+(?:is|means|refers to)\\b|\\b(?:called|known as)\\s+(?:a |the )?${term}\\b)`, 'i').exec(lower);
    return !definition || first < definition.index;
  });
  return { wordsPerMinute: Math.round(words / Math.max(1, end - start) * 60), longestStretchWithoutExampleSec: Math.round(longest), jargonBeforeDefinition };
}
