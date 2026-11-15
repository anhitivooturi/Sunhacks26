// UI audit for the student app: checks the machine-checkable Vercel Web Interface Guidelines in a real browser.
//   cd web && npm run dev                       (terminal 1)
//   npm i -D playwright && npx playwright install chromium     (once)
//   node scripts/ui-audit.mjs                   (terminal 2; BASE_URL=http://localhost:5173 by default)
// Exits 1 if anything fails, so it can gate a PR.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium'); process.exit(2) }

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const SCREENS = [['join', '/join'], ['live: tap', '/s/HACK'], ['live: ask', '/s/HACK?tab=ask'], ['review', '/review/demo-session']]
let failures = 0
const fail = (screen, msg) => { failures++; console.log(`  FAIL [${screen}] ${msg}`) }

const scan = () => {
  const out = { small: [], smallInput: [], unnamed: [], transAll: 0, hscroll: document.documentElement.scrollWidth > innerWidth + 1, h1: document.querySelectorAll('h1').length, title: document.title, noLabelInput: [] }
  for (const el of document.querySelectorAll('button, a[href], input, [role=button], [role=tab]')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || r.bottom < 0) continue
    const name = (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 28)
    if (Math.min(r.width, r.height) < 44 && !el.closest('[aria-hidden="true"]')) out.small.push(`${el.tagName.toLowerCase()} "${name}" ${Math.round(r.width)}x${Math.round(r.height)}`)
    if (el.tagName === 'INPUT' && parseFloat(cs.fontSize) < 16) out.smallInput.push(el.getAttribute('aria-label') || 'input')
    if (el.tagName === 'INPUT' && !el.getAttribute('aria-label') && !(el.labels && el.labels.length)) out.noLabelInput.push(el.outerHTML.slice(0, 50))
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && !name && !el.getAttribute('aria-label')) out.unnamed.push(el.outerHTML.slice(0, 60))
  }
  for (const el of document.querySelectorAll('*')) { const cs = getComputedStyle(el); if (cs.transitionProperty === 'all' && parseFloat(cs.transitionDuration) > 0) out.transAll++ }
  return out
}

const browser = await pw.chromium.launch()
const phone = await browser.newContext({ ...pw.devices['iPhone 14 Pro'] })
const page = await phone.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|vibrate/.test(m.text())) errors.push(m.text()) })

for (const [name, path] of SCREENS) {
  console.log(`\n${name}  ${path}`)
  await page.goto(BASE + path); await page.waitForTimeout(2600)
  const r = await page.evaluate(scan)
  if (r.small.length) fail(name, `targets under 44px: ${r.small.join('; ')}`)
  if (r.smallInput.length) fail(name, `inputs under 16px (iOS zooms): ${r.smallInput.join(', ')}`)
  if (r.unnamed.length) fail(name, `controls with no accessible name: ${r.unnamed.length}`)
  if (r.noLabelInput.length) fail(name, `inputs with no label: ${r.noLabelInput.length}`)
  if (r.transAll) fail(name, `${r.transAll} element(s) use transition: all`)
  if (r.hscroll) fail(name, 'horizontal scroll')
  if (r.h1 !== 1) fail(name, `expected exactly one h1, found ${r.h1}`)
  if (/^pulse$/i.test(r.title) || !r.title) fail(name, `generic page title "${r.title}"`)
  if (!failures) console.log('  ok')
}

// keyboard must be able to do the main action
await page.goto(BASE + '/s/HACK'); await page.waitForTimeout(2600)
await page.locator('button.tap').first().focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(400)
console.log('\nkeyboard: Enter on the Lost button')
if ((await page.locator('button.tap').first().getAttribute('data-cool')) !== '1') fail('live', 'Enter/Space did not register a tap'); else console.log('  ok')
const ring = await page.locator('button.tap').nth(1).focus().then(() => page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle))
if (ring === 'none') fail('live', 'focused control shows no outline'); else console.log('  focus ring: ok')

if (errors.length) fail('console', errors.slice(0, 3).join(' | '))
await browser.close()
console.log(failures ? `\n${failures} problem(s).` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
