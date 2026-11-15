// Feel layer: haptics (Android vibrate + iOS switch trick), tiny WebAudio sounds, canvas confetti.
// All of it is progressive enhancement and respects prefers-reduced-motion + the Settings toggles.
import { store } from './storage.js'
const pref = k => store.get('pulse.settings', {})[k]
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

let sw
function iosTick() {
  try {
    if (!sw) {
      const l = document.createElement('label'); l.setAttribute('aria-hidden', 'true')
      l.style.cssText = 'position:fixed;left:-99px;top:-99px;opacity:0;pointer-events:none'
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); l.appendChild(i); document.body.appendChild(l); sw = l
    }
    sw.click()
  } catch { /* unsupported */ }
}
export function haptic(pattern = 18) {
  if (pref('haptics') === 'off') return
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return // browsers block buzzing before the first touch
  try { if (navigator.vibrate) { navigator.vibrate(pattern); return } } catch { /* fall through */ }
  iosTick()
}

let ac
function tone(f, d = 0.09, type = 'sine', v = 0.05, slide = 0) {
  if (pref('sound') !== 'on') return
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)()
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain()
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + d)
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(t + d)
  } catch { /* no audio */ }
}
export const sfx = {
  tap: kind => tone({ lost: 330, slow: 262, fast: 523, got_it: 660 }[kind] || 440, 0.1, 'triangle', 0.05, kind === 'lost' ? 0.7 : 1.25),
  good: () => { tone(660, 0.1, 'triangle'); setTimeout(() => tone(880, 0.12, 'triangle'), 90) },
  bad: () => tone(200, 0.2, 'sawtooth', 0.035, 0.6),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle'), i * 95)),
}

let cv, ctx, parts = [], raf = 0
function resize() { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0) }
function ensure() {
  if (cv) return
  cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true')
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  document.body.appendChild(cv); ctx = cv.getContext('2d'); resize(); addEventListener('resize', resize)
}
function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight)
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40)
  for (const p of parts) {
    p.vy += p.g; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.decay
    ctx.save(); ctx.globalAlpha = Math.min(1, p.life * 2.2); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c
    if (p.glyph) { ctx.font = `700 ${p.r * 3.2}px Caveat, cursive`; ctx.textAlign = 'center'; ctx.fillText(p.glyph, 0, 0) }
    else if (p.shape) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
    else { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.7, 0, 7); ctx.fill() }
    ctx.restore()
  }
  raf = parts.length ? requestAnimationFrame(tick) : 0
  if (!raf) ctx.clearRect(0, 0, innerWidth, innerHeight)
}
export function burst({ x = innerWidth / 2, y = innerHeight / 2, count = 30, colors = ['#ffe14d', '#ff5a47', '#4cc2ff', '#3ddc97', '#f4f1e6'], spread = Math.PI * 2, angle = -Math.PI / 2, speed = 9, glyph = null, gravity = 0.32 } = {}) {
  if (reduced()) return
  ensure()
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread, v = speed * (0.45 + Math.random() * 0.7)
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 3.5 + Math.random() * 4.5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      life: 1, decay: 0.009 + Math.random() * 0.01, g: gravity, c: colors[(Math.random() * colors.length) | 0], shape: Math.random() > 0.5, glyph: glyph && Math.random() > 0.35 ? glyph : null })
  }
  if (!raf) raf = requestAnimationFrame(tick)
}
export function celebrate() {
  burst({ x: 0, y: innerHeight, angle: -Math.PI / 3.2, spread: 0.9, speed: 19, count: 70, gravity: 0.34 })
  burst({ x: innerWidth, y: innerHeight, angle: (-Math.PI * 2.2) / 3.2, spread: 0.9, speed: 19, count: 70, gravity: 0.34 })
}
