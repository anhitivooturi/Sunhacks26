# DESIGN.md: Wait, what? (student app)

How the student screens should look and feel. Coding agents read `AGENTS.md`; design agents read this. Tokens live in `student.css` (`.ww`) and `web/tailwind.config.js`.

## 1. Visual theme and atmosphere
A lecture-hall interruption. The student is sitting in class with a pen in one hand, so the phone must be calm and fast: a **chalkboard** world, **highlighter yellow** emphasis, chunky **speech-bubble sticker** buttons with hard offset shadows, and **Caveat** handwriting for margin notes. After class the world flips to a **ruled notebook page**. The mascot is Pip, a yellow speech bubble with one raised eyebrow. Mood: playful, never noisy. Density: low on the tap screen (four huge targets), medium on the notebook.

## 2. Color palette and roles
| Token | Hex | Role |
|---|---|---|
| `ink` | `#0f1a17` | Chalkboard ground, text on yellow and on stickers |
| `chalk` | `#f4f1e6` | Primary text on dark, code tickets, bubbles |
| `hl` | `#ffe14d` | Highlighter: primary CTA, active tab, the one emphasized word. Its shadow is `#b89f10` |
| `lost` | `#ff5a47` | Lost button, "lost" data, errors |
| `slow` | `#ff9f1c` | Slow down button, offline banner, validation hints |
| `fast` | `#4cc2ff` | Speed up button, examples |
| `got` | `#3ddc97` | Got it button, correct answers, success |
| `violet` | `#8b7bff` | Neutral "answer sent" state |
| paper | `#fbf9f1` | Notebook page. Ruled lines `rgba(76,130,200,.22)`, margin `rgba(255,90,71,.5)` |
| paper ink | `#181a20` | Text and borders on the notebook |

Yellow is the only accent for emphasis. The four kind colors carry meaning and are never used decoratively. Never rely on color alone: pair with a label or icon.

## 3. Typography rules
- **Bricolage Grotesque** 700/800: display, buttons, numbers. Tight tracking (`-.02em` to `-.045em`), line-height `.92` to `1.1`.
- **Inter** 400/600: body, `text-wrap: balance` on headings.
- **Caveat** 600/700: margin scribbles, hints, labels like "what was said". Never for paragraphs.
- Accessibility fonts selectable in Settings: Atkinson Hyperlegible, OpenDyslexic. Caption size scale `sm 1rem / md 1.375rem / lg 1.875rem / xl 2.5rem`.
- Hero title `clamp(3.5rem, min(13vw, 17dvh), 11rem)`. Mono for code/examples. `tnum` on every counter.

## 4. Component stylings
- **Tap sticker**: radius `2rem`, flat fill of the kind color with a lighter top, hard shadow `0 8px 0` in the same color at 55% black, a speech-bubble tail bottom-left (bottom-right for even items). Press sinks `6px`. Cooldown is a white conic ring that sweeps 3s, label becomes "got it, noted". Hover (fine pointers only) lifts `3px`.
- **Code ticket cells**: chalk fill, `3px` ink border, hard shadow, slight alternating rotation. Focus turns yellow and lifts.
- **CTA**: yellow gradient, radius `1.25rem`, shadow `0 8px 0 #b89f10`. Incomplete state is dimmed but still enabled, so it can explain what is missing.
- **Glass sheet**: `rgba(244,241,230,.06)` fill, `1.5px` chalk 16% border, hard shadow. Notebook variant: white, `2px` ink border, `5px 6px 0` ink shadow.
- **Highlighter mark** (`.hl`, `mark.q`): yellow block behind one phrase, slight rotation. One per view.
- **Pop bubble**: chalk pill with ink border, Caveat 700, floats up and fades in 1.15s. Decorative (`aria-hidden`).

## 5. Layout principles
Single column on phones, 8-based spacing in rem. The tap screen is a 2x2 grid that fills the viewport (`100dvh`). Landing is two columns from 900px: copy and form left, floating phone right. Safe-area insets respected on every fixed or edge element. No horizontal scroll at any width.

## 6. Depth and elevation
Hard, offset shadows (no blur) for objects you can press; soft ambient glow only behind the landing phone and aurora. Semi-transparent borders sharpen edges. Child radii never exceed parent radii.

## 7. Do's and don'ts
- Do keep the tap screen quiet: one bubble, one tiny burst, one glow.
- Do save confetti for milestones: joining and the quiz result.
- Do give every state a design: empty, loading (skeleton mirrors content), error with a way out, offline.
- Do keep hit targets at least 44px and give keyboard focus a yellow ring.
- Don't use `transition: all`, global selectors in `student.css`, emoji as section markers, or purple-to-blue gradients.
- Don't block typing silently: say why a letter was refused.
- Don't hide content behind JS reveal. Scroll reveal is CSS-only and optional.

## 8. Responsive behavior
Breakpoints: below 900px single column and no phone mockup; 900px and up two columns. Test 390x844, 1280x720 and 1920x1080. Min tap target 44px. `prefers-reduced-motion` removes animation and confetti. `pointer: fine` enables cursor spotlight, phone lean and Pip eye-tracking.

## 9. Agent prompt guide
- Quick colors: ground `#0f1a17`, text `#f4f1e6`, accent `#ffe14d`, lost `#ff5a47`, slow `#ff9f1c`, fast `#4cc2ff`, got `#3ddc97`.
- "Build a new student screen on the chalkboard: Bricolage 800 headline with one `.hl` word, glass sheets, yellow CTA with a hard shadow, Caveat hint text, 44px targets, keyboard focus ring, an empty and an error state."
- "Build a notebook section: `.paper` wrapper, white `.glass` cards with ink border and hard shadow, Caveat labels, highlighter on the evidence quote."
