import { useEffect, useRef } from 'react'
import SettingsPanel from './SettingsPanel.jsx'

// Settings live behind one gear (progressive disclosure): the live screen shows three tabs, not four.
export default function SettingsSheet({ open, onClose }) {
  const closeRef = useRef()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    closeRef.current?.focus()
    const esc = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('keydown', esc); prev?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet sheet-bg fixed inset-0 z-40 overflow-y-auto rise" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="mx-auto max-w-md px-5 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center justify-between">
          <p className="label">Settings</p>
          <button ref={closeRef} onClick={onClose} className="btn-ghost min-h-11 text-sm">Done</button>
        </div>
        <SettingsPanel />
      </div>
    </div>
  )
}
