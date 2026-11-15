import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../lib/theme.js';
import { USE_MOCK } from '../lib/config.js';
import Pip from '../student/components/Mascot.jsx';

// Same mark as the student app: Pip + "Wait, what?" with "what?" highlighted. The chip says whose screen this is.
export function Wordmark({ className = 'text-2xl' }) {
  return (
    <span translate="no" className={`wordmark whitespace-nowrap ${className}`}>
      Wait, <span className="hl-mark">what?</span>
    </span>
  );
}

export function Logo() {
  return (
    <Link to="/host" className="flex items-center gap-2" aria-label="Wait, what? for teachers, home">
      <Pip size={30} beat={false} />
      <Wordmark className="text-xl" />
      <span className="rounded bg-slate-900 px-1.5 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-wide text-slate-50 dark:bg-chalk dark:text-ink">
        teacher
      </span>
    </Link>
  );
}

// nav=false during a live class, so nobody wanders off mid-lecture by accident.
export function TopBar({ children, nav = true }) {
  const [theme, toggle] = useTheme();
  const link = ({ isActive }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-slate-200/70 text-slate-900 dark:bg-slate-800 dark:text-slate-50' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`;
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
      <Logo />
      {nav && (
        <nav className="flex items-center gap-1" aria-label="Main">
          <NavLink to="/host" end className={link}>Start class</NavLink>
          <NavLink to="/classes" className={link}>Classes</NavLink>
          {/* What students see on their phones (Person D's app). */}
          <NavLink to="/join" className={link}>Student view</NavLink>
        </nav>
      )}
      {USE_MOCK && <span className="rounded-full bg-slow/20 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-slow">mock data</span>}
      <div className="ml-auto flex flex-wrap items-center gap-3">
        {children}
        <button onClick={toggle} className="btn-ghost text-sm" aria-label={theme === 'dark' ? 'Switch to paper theme (light)' : 'Switch to board theme (dark)'}>
          <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span> {theme === 'dark' ? 'Paper' : 'Board'}
        </button>
      </div>
    </header>
  );
}

export function StatusDot({ status }) {
  const map = {
    open: ['bg-got', 'Live'],
    mock: ['bg-slow', 'Mock feed'],
    connecting: ['bg-slate-400 animate-pulse', 'Connecting'],
    reconnecting: ['bg-slow animate-pulse', 'Reconnecting'],
  };
  const [cls, label] = map[status] || map.connecting;
  return (
    <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <span className={`h-2.5 w-2.5 rounded-full ${cls}`} /> {label}
    </span>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-slate-500">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-pulse-500 dark:border-slate-700" />
      {label}
    </div>
  );
}

// Errors say what happened and what to do next (Vercel + Refero copy rules), never just "Something went wrong".
export function ErrorBox({ title = 'Couldn’t load this page', message, hint, onRetry }) {
  return (
    <div role="alert" className="mx-auto my-16 max-w-md card text-center">
      <div className="mb-2 text-lg font-semibold">{title}</div>
      {hint && <p className="mb-2 text-sm">{hint}</p>}
      {message && <p className="mb-4 font-mono text-xs text-slate-500">{message}</p>}
      <div className="flex justify-center gap-3">
        {onRetry && <button className="btn-primary" onClick={onRetry}>Try again</button>}
        <a href="/host" className="btn-ghost">Start a new session</a>
      </div>
    </div>
  );
}
