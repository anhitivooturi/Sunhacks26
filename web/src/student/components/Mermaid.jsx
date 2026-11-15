import { useEffect, useRef, useState } from 'react'
let mm; let n = 0
export default function Mermaid({ code, light = false }) {
  const ref = useRef(null); const [err, setErr] = useState(false)
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        mm ||= (await import('mermaid')).default
        mm.initialize({ startOnLoad: false, theme: light ? 'neutral' : 'dark', securityLevel: 'strict', themeVariables: light ? {} : { primaryColor: '#1c1c2e', primaryBorderColor: '#ff3d71', primaryTextColor: '#fff', lineColor: '#8b5cf6' } })
        const { svg } = await mm.render('mm' + n++, code)
        if (!dead && ref.current) { ref.current.innerHTML = svg; setErr(false) }
      } catch { if (!dead) setErr(true) }
    })()
    return () => { dead = true }
  }, [code, light])
  if (err) return <pre className="whitespace-pre-wrap text-xs muted">{code}</pre>
  return <div ref={ref} className="flex justify-center overflow-x-auto [&_svg]:max-w-full" />
}
