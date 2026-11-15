import { useTheme } from '../lib/theme.js';

// Every teacher page sits inside the same container as the student app (`.ww`), so fonts, colors and the
// student accessibility settings (dyslexia font, caption size, high contrast) apply here too.
//   Board theme -> the student chalkboard (`.board`: glow + chalk-dot grid), optionally with drifting chalk marks.
//   Paper theme -> the student notebook page (`.paper`: ruled lines + red margin).
// `calm` (live screen): no drifting marks, nothing moves behind the content.
const MARKS = ['wait', '?!', 'huh?', '?', 'what', '…?', 'hm', '?'];

export default function TeacherShell({ children, calm = false, marks = false, className = '' }) {
  const [theme] = useTheme();
  const board = theme === 'dark';
  return (
    <div className={`ww tw ${board ? 'tw-board' : 'paper tw-paper'} ${className}`}>
      {board && (
        <div className="board" aria-hidden>
          {!calm &&
            marks &&
            MARKS.map((m, i) => (
              <b
                key={i}
                style={{
                  left: `${(i * 13 + 4) % 92}%`,
                  bottom: `-${10 + (i % 3) * 8}%`,
                  '--s': `${3 + (i % 3) * 1.5}rem`,
                  '--d': `${34 + i * 5}s`,
                  '--w': `${-i * 6}s`,
                  '--r': `${i % 2 ? 8 : -10}deg`,
                }}
              >
                {m}
              </b>
            ))}
        </div>
      )}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
