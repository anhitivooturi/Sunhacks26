const MAP = {
  live: ['#3ddc97', 'Live'], connecting: ['#ff9f1c', 'Connecting'], reconnecting: ['#ff9f1c', 'Reconnecting'], bad_code: ['#ff5a47', 'Bad code'], mock: ['#8b7bff', 'Demo'],
}
export default function StatusDot({ status, mock }) {
  const [c, label] = MAP[mock && status === 'live' ? 'mock' : status] || MAP.connecting
  return (
    <span className="inline-flex items-center gap-2 text-xs muted" role="status" aria-label={`Connection: ${label}`}>
      <span className="relative flex h-2.5 w-2.5">
        {status !== 'live' && <span className="absolute inset-0 animate-ping rounded-full" style={{ background: c, opacity: .6 }} />}
        <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} />
      </span>{label}
    </span>
  )
}
