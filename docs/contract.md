# Pulse contract (frozen)

Everyone builds against this. If something must change, tell the whole team first.
Items marked **PROPOSED** are additions to the original summary that the team still has to approve.

## Time

- `t0` = the moment the host clicks **Start session** (`sessions.started_at`, set by the server).
- Every timestamp in this contract is **seconds since `t0`** (`transcript_ts_sec`, `startSec`, `endSec`).
- The server computes all timestamps. Clients never send them.
- Transcribe returns times relative to its own stream. Person B converts them to `t0` time, including after stream restarts.

## REST

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/sessions` | `{ course, section, title }` (**PROPOSED** body; all optional strings) | `{ id, code, joinUrl, qrDataUrl }` |
| POST | `/sessions/:id/end` | `{}` | `{ ok: true }` (runs the end-of-session job) |
| GET | `/sessions/:id/report` | | Report JSON (below) |
| GET | `/sessions/:id/transcript` | | `[{ startSec, endSec, text }]` |
| GET | `/sessions/:id/review?studentId=` | | **PROPOSED** `{ moments: [Moment] }` (only the moments this student tapped Lost on) |
| GET | `/sessions` | | **PROPOSED** class history for the Classes page: `[{ id, course, section, title, startedAt, durationSec, participants, peakLost, moments, questions, worstTopic, understanding }]` (`peakLost` = highest moment score, `worstTopic` = title of the most confused topic) |
| GET | `/sessions/:id/activity` | | **PROPOSED** every Lost tap and question with its time, for the after-class transcript review: `[{ atSec, kind: "lost" \| "question", text? }]` |
| POST | `/notes` | `{ sessionId, momentId, studentId, format }` | **PROPOSED** `{ format, content }` |

`code` is 4 uppercase letters with no O, I or L. `joinUrl` = `BASE_URL + "/j/" + code`.

## WebSocket

`/ws?code=ABCD&role=student|host`

Every message in both directions is JSON: `{ "type": "<name>", "data": { ... } }`.

### Student to server

- `react { kind }` where kind is `lost | slow | fast | got_it`
- `question { text }`
- `upvote { questionId }`
- `quiz_answer { momentId, qIndex, choice }`

### Host to server

- `push_fix { momentId }`
- `pulse_check {}`
- `mark_answered { questionId }`
- **PROPOSED** `pause {}` / `resume {}` (while paused, students can't tap and nothing is recorded; the transcript stream also stops)

### Server to clients

- `welcome { studentId }` (students only)
- `meter { score, lostCount, active }` (host, every 2 s)
- `transcript { text, final, startSec }`
- `questions { list: [{ id, text, upvotes, answered }] }` (sorted by upvotes)
- `push_fix { moment }` (students; **PROPOSED:** quiz options sent without `answerIndex`, the server scores answers)
- `poll { ... }` (pulse check)
- **PROPOSED** `moment { moment }` (host, sent live as soon as a confusion moment is detected)
- **PROPOSED** `quiz_progress { momentId, answered, correctRate }` (host, after each quiz answer)

## Report JSON

```json
{
  "sessionId": "string",
  "durationSec": 0,
  "participants": 0,
  "topics": [
    { "start": 0, "end": 0, "title": "", "confusion": 0.0, "questions": 0, "understanding": 0.0 }
  ],
  "moments": [
    {
      "id": "m1",
      "startSec": 0, "endSec": 0,
      "score": 0.0, "lostCount": 0, "active": 0,
      "passage": "", "whyConfusing": "undefined_term",
      "evidenceQuote": "", "reexplanation": "", "example": "",
      "quiz": [{ "q": "", "options": ["", "", "", ""], "answerIndex": 0, "explanation": "" }]
    }
  ],
  "unanswered": [{ "id": "", "text": "", "upvotes": 0 }],
  "recap": ""
}
```

`whyConfusing` is one of `undefined_term | skipped_step | too_fast | no_example | assumed_prior_knowledge`.

**PROPOSED optional fields** (the report page shows them when present and works without them):

- Moment: `confidence` (`high | medium | low`), `resolved` (share of correct quiz answers, 0 to 1), `quizAnswered` (count), `summary` (one-line summary from `explainMoment`).
- Report: `deliveryStats { wordsPerMinute, longestStretchWithoutExampleSec, jargonBeforeDefinition: [string] }`.
