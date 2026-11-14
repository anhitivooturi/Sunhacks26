import { Link } from 'react-router-dom';
import { useTheme } from '../lib/theme.js';
import { USE_MOCK } from '../lib/config.js';

export function Logo({ size = 'text-2xl' }) {
  return (
    <Link to="/host" className={`flex items-center gap-2 font-extrabold tracking-tight ${size}`}>
      <svg viewBox="0 0 32 32" className="h-[1.2em] w-[1.2em]" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-pulse-500" />
        <path d="M5 17h6l2.5-6 4 12 3-8 1.5 2H27" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Pulse
    </Link>
  );
}

export function TopBar({ children }) {
  const [theme, toggle] = useTheme();
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
      <Logo />
      {USE_MOCK && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-300">mock data</span>}
      <div className="ml-auto flex flex-wrap items-center gap-3">
        {children}
        <button onClick={toggle} className="btn-ghost text-sm" aria-label="Toggle theme">
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </div>
    </header>
  );
}

export function StatusDot({ status }) {
  const map = {
    open: ['bg-emerald-500', 'Live'],
    mock: ['bg-amber-400', 'Mock feed'],
    connecting: ['bg-slate-400 animate-pulse', 'Connecting'],
    reconnecting: ['bg-amber-500 animate-pulse', 'Reconnecting'],
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
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-slate-500">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-pulse-500 dark:border-slate-700" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="mx-auto my-16 max-w-md card text-center">
      <div className="mb-2 text-lg font-semibold">Something went wrong</div>
      <p className="mb-4 text-sm text-slate-500">{message}</p>
      {onRetry && <button className="btn-primary" onClick={onRetry}>Try again</button>}
    </div>
  );
}
