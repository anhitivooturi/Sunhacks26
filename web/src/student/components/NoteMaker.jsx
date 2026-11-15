import { useState } from 'react'
import Mermaid from './Mermaid.jsx'
import { generateNote } from '../lib/api.js'
import { getStudentId } from '../lib/storage.js'
import { useSettings } from './SettingsContext.jsx'

const FORMATS = [['flashcards', 'Flashcards'], ['diagram', 'Concept diagram'], ['bullets', 'Short bullets'], ['plain', 'Plain language']]

function Flip({ card }) {
  const [f, setF] = useState(false)
  return (
    <button onClick={() => setF(!f)} className="min-h-24 w-full rounded-2xl border border-white/12 bg-white/5 p-4 text-left transition active:scale-[.98] print-break">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: f ? '#34f5a1' : '#22d3ee' }}>{f ? 'Back' : 'Front · tap to flip'}</p>
      <p className="mt-1 font-semibold">{f ? card.back : card.front}</p>
    </button>
  )
}
export function NoteView({ note, light }) {
  if (!note) return null
  const { format, content } = note
  if (format === 'flashcards') return <div className="grid gap-2 sm:grid-cols-3">{content.map((c, i) => <Flip key={i} card={c} />)}</div>
  if (format === 'diagram') return <div className="rounded-2xl bg-white/5 p-3"><Mermaid code={content} light={light} /></div>
  if (format === 'bullets') return <ul className="space-y-1.5">{content.map((b, i) => <li key={i} className="flex gap-2"><span className="text-lost">▸</span>{b}</li>)}</ul>
  return <p className="leading-relaxed">{content}</p>
}

export default function NoteMaker({ sessionId, moment, light }) {
  const { settings, update } = useSettings()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const preferred = FORMATS.find(([v]) => v === settings.noteFormat) || FORMATS[2]
  const others = FORMATS.filter(([v]) => v !== preferred[0])
  const make = async fmt => {
    update({ noteFormat: fmt }); setBusy(true)
    setNote(await generateNote({ studentId: getStudentId(), sessionId, moment, format: fmt }))
    setBusy(false)
  }
  return (
    <div className="space-y-3">
      <p className="label no-print">Study notes</p>
      <div className="no-print flex flex-wrap items-start gap-2">
        <button onClick={() => make(preferred[0])} disabled={busy} className="btn-primary min-h-11">Make {preferred[1].toLowerCase()}</button>
        <details className="more-formats">
          <summary className="btn-ghost min-h-11 cursor-pointer text-sm">More formats</summary>
          <div className="mt-2 flex flex-wrap gap-2">{others.map(([v, l]) => <button key={v} onClick={() => make(v)} disabled={busy} className="btn-ghost min-h-11 text-sm">{l}</button>)}</div>
        </details>
      </div>
      {busy && <div className="h-1 overflow-hidden rounded bg-slate-700/40" role="status" aria-label="Making your notes"><div className="h-full w-1/3 animate-pulse rounded bg-hl" /></div>}
      <div className="rise" key={note?.format}><NoteView note={note} light={light} /></div>
    </div>
  )
}
