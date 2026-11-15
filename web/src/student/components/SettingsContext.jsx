import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { store, getStudentId } from '../lib/storage.js'
import { loadSettings, saveSettings } from '../lib/api.js'

const DEFAULTS = { caption: 'md', font: 'default', contrast: 'normal', noteFormat: 'bullets', sound: 'off', haptics: 'on' }
const Ctx = createContext(null)
export const useSettings = () => useContext(Ctx)

export function SettingsProvider({ children }) {
  const [s, setS] = useState({ ...DEFAULTS, ...store.get('pulse.settings', {}) })
  const [synced, setSynced] = useState('local') // local | saved | offline
  const timer = useRef(); const id = useRef(getStudentId()).current
  useEffect(() => { loadSettings(id).then(r => { if (r) { setS(p => ({ ...p, ...r })); setSynced('saved') } }) }, [id])
  useEffect(() => { // apply instantly
    const d = document.documentElement
    d.dataset.cap = s.caption; d.dataset.font = s.font; d.dataset.contrast = s.contrast
  }, [s])
  const update = patch => {
    setS(p => {
      const next = { ...p, ...patch }
      store.set('pulse.settings', next)
      clearTimeout(timer.current)
      timer.current = setTimeout(async () => setSynced((await saveSettings(id, next)) ? 'saved' : 'offline'), 500)
      return next
    })
  }
  return <Ctx.Provider value={{ settings: s, update, synced }}>{children}</Ctx.Provider>
}
