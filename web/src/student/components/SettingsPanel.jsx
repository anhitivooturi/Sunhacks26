import { useSettings } from './SettingsContext.jsx'

const Seg = ({ value, options, onChange, label }) => (
  <div role="radiogroup" aria-label={label} className="flex gap-1.5 rounded-2xl bg-white/5 p-1.5">
    {options.map(([v, l]) => (
      <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
        className={`min-h-11 flex-1 rounded-xl px-2 py-2.5 text-sm font-semibold transition ${value === v ? 'bg-white text-black shadow-lg' : 'text-white/70 hover:bg-white/10'}`}>{l}</button>
    ))}
  </div>
)
export default function SettingsPanel() {
  const { settings: s, update, synced } = useSettings()
  return (
    <div className="space-y-5 rise">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Make it yours</h2>
        <span className="text-xs muted">{synced === 'saved' ? '☁ saved to Atlas' : synced === 'offline' ? 'saved on this phone' : 'saved on this phone'}</span>
      </div>
      <section className="space-y-2"><h3 className="text-sm muted">Caption size</h3>
        <Seg label="Caption size" value={s.caption} onChange={v => update({ caption: v })} options={[['sm', 'S'], ['md', 'M'], ['lg', 'L'], ['xl', 'XL']]} />
        <p className="cap rounded-2xl bg-white/5 p-3">So obviously the function needs a base case…</p>
      </section>
      <section className="space-y-2"><h3 className="text-sm muted">Font</h3>
        <Seg label="Font" value={s.font} onChange={v => update({ font: v })} options={[['default', 'Default'], ['atkinson', 'Atkinson'], ['dyslexic', 'Dyslexic']]} />
      </section>
      <section className="space-y-2"><h3 className="text-sm muted">Contrast</h3>
        <Seg label="Contrast" value={s.contrast} onChange={v => update({ contrast: v })} options={[['normal', 'Normal'], ['high', 'High contrast']]} />
      </section>
      <section className="space-y-2"><h3 className="text-sm muted">Feedback</h3>
        <Seg label="Haptics" value={s.haptics} onChange={v => update({ haptics: v })} options={[['on', 'Haptics on'], ['off', 'Haptics off']]} />
        <Seg label="Sound" value={s.sound} onChange={v => update({ sound: v })} options={[['off', 'Silent'], ['on', 'Sound on']]} />
      </section>
      <section className="space-y-2"><h3 className="text-sm muted">Preferred note format</h3>
        <Seg label="Note format" value={s.noteFormat} onChange={v => update({ noteFormat: v })} options={[['flashcards', 'Cards'], ['diagram', 'Diagram'], ['bullets', 'Bullets'], ['plain', 'Plain']]} />
      </section>
    </div>
  )
}
