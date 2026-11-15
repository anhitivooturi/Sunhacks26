# Fixtures (Person D): demo lecture "Recursion" (8:00)

Built to match `docs/contract.md`. Regenerate and validate: `node scripts/build-fixtures.mjs`

| File | Shape |
|---|---|
| `transcript.json` | `[{startSec, endSec, text}]`, contiguous, 25 chunks. Confusing passage 156-192s ("base case" and "stack unwinds" used before they are defined; the base case is defined at 252s). A milder spike at 352-392s (memoization). |
| `events.json` | `[{id, sessionId, studentId, type, transcriptTsSec, createdAt, payload}]`. 20 students. Tap `type` is the contract kind: `lost`, `slow`, `fast`, `got_it` (payload `{kind}`), plus `question`, `upvote`, `mark_answered`, `push_fix`, `quiz_answer` (payload `{momentId, qIndex, choice, correct}`). 14 distinct Lost taps at 176-198s, 6 at 375-392s. |
| `report.json` | Contract report shape. 3 topics, 2 moments, evidence quotes are exact substrings of the transcript (the script fails otherwise), 3 quiz questions with 4 options each. `whyConfusing` is the reason code. |

The report also carries the contract's **PROPOSED optional fields** so the report page and review page can be tried with them: `summary`, `confidence`, `resolved`, `quizAnswered` on moments and `deliveryStats` on the report. Everything works if they are absent.

## Still PROPOSED in the contract (student app handles both ways)
- `welcome { studentId, sessionId }`: the student app needs a session id for `/review/:sessionId`. If `sessionId` is missing it falls back to the class code.
- `push_fix` without `answerIndex`: the student app shows "answer sent" instead of right/wrong and the review page shows the explanations.
- `GET /sessions/:id/review?studentId=` and `POST /notes`: used when the real server is on; otherwise the app matches Lost taps locally and builds notes from canned text.
