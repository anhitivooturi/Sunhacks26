import { useEffect, useState } from 'react';

// Two brand themes: "board" (chalkboard ink, the default, same as the student app) and "paper"
// (chalk-white, for bright rooms where a dark projector image washes out). See DESIGN.md.
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('pulse-theme') || 'dark';
    } catch {
      return 'dark';
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1a17' : '#f7f6f0');
    try {
      localStorage.setItem('pulse-theme', theme);
    } catch {
      /* private mode */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
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
