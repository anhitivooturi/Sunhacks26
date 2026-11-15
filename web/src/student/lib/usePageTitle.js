import { useEffect } from 'react'

// Vercel guideline: <title> reflects the current context, and the browser UI (theme-color) matches the page background.
export function usePageTitle(title, themeColor = '#0f1a17') {
  useEffect(() => {
    const prevTitle = document.title
    let meta = document.querySelector('meta[name="theme-color"]')
    const created = !meta
    if (created) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta) }
    const prevColor = meta.content
    document.title = title; meta.content = themeColor
    return () => { document.title = prevTitle; if (created) meta.remove(); else meta.content = prevColor }
  }, [title, themeColor])
}
