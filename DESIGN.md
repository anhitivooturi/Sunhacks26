---
name: wait-what-design
description: "Wait, what? is a classroom tool with one voice across two apps. Students get a dark chalkboard phone app with big tactile tap buttons. Professors get a calm projector screen in the same brand. The signature device is a tilted yellow highlighter over the words that matter (\"what?\", the join code, the sentence that lost the class). Colors carry meaning: the four student taps (Lost, Slow down, Speed up, Got it) are the only saturated colors, and the professor screens reuse them so a teacher sees the exact color students pressed."

colors:
  ink: "#0f1a17"          # chalkboard, the default canvas (board theme)
  board-glow: "#17302a"   # top of the chalkboard radial gradient
  chalk: "#f4f1e6"        # text on ink, and the paper theme canvas family
  paper: "#f7f6f0"        # paper theme page (slate-50)
  hl: "#ffe14d"           # highlighter: primary buttons, wordmark, evidence quotes, join code
  hl-shadow: "#b89f10"    # hard shadow under yellow buttons
  lost: "#ff5a47"         # Lost tap; also the professor emphasis color (pulse-500)
  slow: "#ff9f1c"         # Slow down tap; "some confusion"
  fast: "#4cc2ff"         # Speed up tap
  got: "#3ddc97"          # Got it tap; "clear", fix worked
  neutrals: "slate-50..950, re-tinted toward ink green in web/tailwind.config.js (professor screens only)"

typography:
  display: "Bricolage Grotesque 800, letter-spacing -0.02em: wordmark, headlines, big numbers (.wordmark / .display)"
  body: "Inter 400/500/600 for everything else (one UI font)"
  hand: "Caveat 700, margin notes only (\"wait, what?!\", \"ohh, they get it now!\"), never for content people must read carefully"
  mono: "JetBrains Mono, timestamps and technical details only"

rounded:
  button: 12px
  card: 16px
  pill: 9999px
---

## Overview

Both apps are one product. The student app (web/src/student, Person D) set the brand: chalkboard ink,
chalk text, Pip the speech-bubble mascot, tactile tap buttons with hard shadows, handwritten margin notes,
and a yellow highlighter. The professor screens (web/src/host and web/src/report, Person C) use the same
pieces at a calmer volume, because a professor glances at them mid-sentence on a projector.

## Rules

### Do
- Put the highlighter (`.hl` in the student app, `.hl-mark` / `.evidence` on professor screens) on the one
  phrase that matters per screen. Never on more than one or two things at once.
- Use the tap colors for meaning only: lost = confused, slow = some confusion, got = clear or the fix worked.
  Always pair a color with a word ("Lost", "Clear") so status never depends on color alone.
- Put ink text on colored fills (yellow, coral, green), the way the student tap buttons do. Not white.
- Primary action = yellow highlighter button with ink text and a hard 4px shadow (`.btn-primary`).
  One primary button per area. Everything else is `.btn-ghost`.
- Use boxes (`.card`) only for things you interact with. Read-only groups use `.section` (a hairline on top).
- Default professor theme is **Board** (ink). **Paper** is the light option for bright rooms where a dark
  projector image washes out. Students always get the board.
- Write copy as scenes and actions: "Send fix to phones", "End & build report", "Start class".
  Errors say what happened and what to do next. Empty states teach what will appear.
- Pip appears once per screen at most, at a moment that earns it (start screen, fix worked).

### Don't
- Don't add indigo/violet, gradients, glows or a second accent color on professor screens.
- Don't animate anything that isn't feedback, continuity or hierarchy. No confetti on the professor side.
- Don't use `transition: all` or animate width/height/top/left. Use transform and opacity.
- Don't use the handwritten font for anything longer than a few words.
- Don't call the product "Pulse" in the UI. The name is **Wait, what?** ("Pulse" only survives in code ids
  and storage keys).

## Motion
- 120 ms for hover/press, about 200 ms for small state changes, up to 1.5 s only for the live meter
  easing toward a new value. Everything respects `prefers-reduced-motion`.
- Live screen: the meter is the figure. New confusion moments get a 5 s spotlight while the rest dims,
  and a small "+N" floats up when more students get lost.

## Accessibility (from docs/design/web-interface-guidelines.md)
- Visible keyboard focus via `:focus-visible` on every control.
- Icon-only buttons have `aria-label`. New moments are announced with `aria-live="polite"`.
- `<title>` names the current screen ("Live · ABCD · 7 lost · Wait, what?").
- Tabular numbers for anything compared or counted.
- The selected report moment is in the URL (`?m=m2`) so links open the same moment.

## Sources
- Student app styles: web/src/student/student.css and web/tailwind.config.js (Person D)
- Vercel Web Interface Guidelines: docs/design/web-interface-guidelines.md (MIT)
- Refero design method (anti-generic rules for color, cards, copy, motion): github.com/referodesign/refero_skill
- DESIGN.md format: github.com/VoltAgent/awesome-design-md
