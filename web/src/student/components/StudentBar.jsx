import { Link } from 'react-router-dom'
import { Wordmark } from '../../components/Chrome.jsx'
import Pip from './Mascot.jsx'
import { USE_MOCK } from '../lib/connection.js'

// Same top bar as the teacher side (Chrome.jsx): Pip + "Wait, what?" + a chip saying whose screen this is.
export function StudentLogo({ mood = 'idle', compact = false }) {
  return (
    <Link to="/join" className="flex min-h-11 items-center gap-2" aria-label="Wait, what? for students, home">
      <Pip size={compact ? 28 : 30} beat={false} mood={mood} />
      <Wordmark className={compact ? 'text-lg' : 'text-xl'} />
      <span className="student-chip rounded bg-chalk px-1.5 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-wide text-ink">student</span>
    </Link>
  )
}

export default function StudentBar({ children, light = false, teacherLink = true, mood = 'idle' }) {
  return (
    <header className={`relative z-20 flex items-center gap-x-3 border-b px-3 py-2 sm:gap-x-4 sm:px-6 ${light ? 'border-slate-200 bg-slate-50/80' : 'border-slate-800'}`}>
      <StudentLogo mood={mood} />
      {USE_MOCK && <span className="hidden rounded-full bg-slow/20 px-2 py-0.5 text-xs font-semibold text-slow sm:inline">mock data</span>}
      <div className="ml-auto flex items-center gap-2">
        {children}
        {teacherLink && <Link to="/host" className="btn-ghost min-h-11 whitespace-nowrap px-3 text-sm"><span className="sm:hidden">Teachers</span><span className="hidden sm:inline">For teachers</span></Link>}
      </div>
    </header>
  )
}
