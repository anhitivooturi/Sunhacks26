import { useEffect, useSyncExternalStore } from 'react';

// Two brand themes, both borrowed from the student app:
//   "dark"  = Board: the chalkboard (default, same as the student join/tap screens)
//   "light" = Paper: the notebook page (same as the student review page) for bright rooms
// One shared store, so the toggle in the top bar re-themes every component at once.
const KEY = 'pulse-theme';
const listeners = new Set();
let current = (() => {
  try {
    return localStorage.getItem(KEY) || 'dark';
  } catch {
    return 'dark';
  }
})();

function apply(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1a17' : '#fbf9f1');
}
apply(current);

function setTheme(t) {
  current = t;
  apply(t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current
  );
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')];
}

// <title> reflects the current screen (Vercel guideline).
export function useTitle(title) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} · Wait, what?` : 'Wait, what?';
    return () => {
      document.title = prev;
    };
  }, [title]);
}
