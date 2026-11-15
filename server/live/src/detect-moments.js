export const LOOKBACK_START_SEC = 20;
export const LOOKBACK_END_SEC = 4;
export const BUCKET_SEC = 10;
export const ACTIVE_WINDOW_SEC = 120;
export const MIN_LOST_STUDENTS = 3;
export const CONFUSION_THRESHOLD = 0.3;

const time = event => Number(event.transcript_ts_sec);
const distinctStudents = events => new Set(events.map(e => e.student_id).filter(Boolean));

// Bucket the reaction time; attribute its evidence to the preceding transcript.
// The same lost tap contributes to exactly one candidate bucket.
export function detectMoments(events, threshold = CONFUSION_THRESHOLD) {
  const sorted = [...events].filter(e => Number.isFinite(time(e))).sort((a, b) => time(a) - time(b));
  const buckets = new Map();
  for (const event of sorted) {
    if (event.type !== 'react' || event.payload?.kind !== 'lost' || !event.student_id) continue;
    const bucket = Math.floor(time(event) / BUCKET_SEC) * BUCKET_SEC;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push(event);
  }
  const candidates = [];
  for (const [bucket, taps] of buckets) {
    const end = bucket + BUCKET_SEC;
    const activeIds = distinctStudents(sorted.filter(e => time(e) > end - ACTIVE_WINDOW_SEC && time(e) < end));
    const lostIds = distinctStudents(taps);
    if (lostIds.size < MIN_LOST_STUDENTS || lostIds.size / Math.max(activeIds.size, 1) < threshold) continue;
    candidates.push({ bucket, startSec: Math.max(0, Math.min(...taps.map(time)) - LOOKBACK_START_SEC),
      endSec: Math.max(0, Math.max(...taps.map(time)) - LOOKBACK_END_SEC), lostIds, activeIds });
  }
  const merged = [];
  for (const candidate of candidates) {
    const last = merged.at(-1);
    if (last && candidate.bucket === last.lastBucket + BUCKET_SEC) {
      last.lastBucket = candidate.bucket;
      last.endSec = candidate.endSec;
      candidate.lostIds.forEach(id => last.lostIds.add(id));
      candidate.activeIds.forEach(id => last.activeIds.add(id));
    } else merged.push({ ...candidate, lastBucket: candidate.bucket });
  }
  return merged.map((m, i) => ({ id: `moment-${i + 1}`, startSec: m.startSec, endSec: m.endSec,
    score: m.lostIds.size / Math.max(m.activeIds.size, 1), lostCount: m.lostIds.size, active: m.activeIds.size }));
}

export async function detectSessionMoments(store, sessionId, threshold) {
  return detectMoments(await store.listEvents(sessionId), threshold);
}
