# Student app design notes (Person D)

The brand, colors, type, do's and don'ts live in the shared **root `DESIGN.md`**. Read that first. This file only covers what is specific to the phone app and how it stays aligned with the teacher screens.

## One system, two volumes
The student app reuses the teacher side's building blocks instead of its own:

| Need | Use | Not |
|---|---|---|
| Something you tap or type into | `.card` (hairline, no shadow on the board) | glass sheets, hard-shadow boxes |
| A read-only group | `.section` (hairline on top) | a box inside a box |
| Small heading | `.label` (uppercase, tracked) | handwriting |
| Primary action | `.btn-primary` (flat yellow, 4px hard shadow), one per area | gradients, glows |
| Secondary action | `.btn-ghost` | custom outlines |
| Headline or big number | `.display` | any other display face |
| Wordmark and top bar | `Wordmark` from `components/Chrome.jsx`, `StudentBar` | a custom header |
| Status | `StatusDot` from `components/Chrome.jsx` | a banner |
| Connected steps | `StepRail` (same look as the report's Detect, Explain, Fix, Verify bar) | unconnected badges |

Students always get the **board** theme: `routes.jsx` adds `dark` to `<html>` while a student screen is mounted and restores the teacher's choice when leaving. The review screen is a ruled **notebook page** (Paper surfaces: `#fbf9f1` page, white cards, `#dfddd2` hairlines).

What stays student-only: the four tap stickers (the only saturated colors besides the highlighter), the code ticket cells, Pip's cursor tracking, the join and quiz confetti, haptics and sound. Everything else is the teacher's calm.

## UX laws applied (and where)
| Law | Where it shows up |
|---|---|
| **Closure** | "How it works" is a snap scroller on phones with the next card peeking in (about 24% visible); a bento grid on desktop. |
| **Figure-ground** | After a tap the other three buttons step back to 32% for 1.5 s. While the "others are lost too" card is up, all four dim. The fix and settings sheets cover the page fully. Collapsed notebook moments sit at 78% while one is open. |
| **Banner blindness** | No announcement bars. Reconnecting and anonymity are inline status text beside the connection dot. "For teachers" is a plain ghost link, not a promo band. Pushed fixes open a sheet, not a banner. |
| **Parkinson's law** | "Rejoin HACK" if you were in a class in the last 6 hours. Three one-tap questions ("Can you repeat that?"). Settings and note format are remembered. QR links need zero typing. |
| **Connectedness** | `StepRail` joins Detect, Explain, Fix, Verify in each notebook moment, Re-explain, Check, Result in the fix sheet, and the four steps on the landing page. |
| **Choice overload** | Live screen has three tabs; Settings sits behind one gear. Notes show your preferred format as the one primary button and the other three under "More formats". The notebook opens the worst moment and folds the rest. |

## Rules specific to this app
- Student CSS is scoped under `.ww` in `student.css`. No global selectors.
- 44px minimum targets, 16px minimum inputs, never `transition: all`, every control reachable and operable by keyboard. `node scripts/ui-audit.mjs` checks this.
- Confetti only for milestones (joining, quiz result). A tap gets one speech-bubble pop and at most ten small particles.
- Every screen sets its `<title>`, has one `h1`, and designs empty, loading, error and offline states.
- Don't block typing silently: say why a letter was refused (join code).
- Never hide content behind a JavaScript reveal. Scroll reveal is CSS-only and optional.
- The selected notebook moment lives in the URL (`?m=`), the live tab in `?tab=`.
