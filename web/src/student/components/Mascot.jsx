// Pip: a speech bubble caught mid-"wait, what?". Moods: idle | sleepy | happy | worried | cheer
export default function Pip({ size = 160, mood = 'idle', className = '', beat = true, look = null }) {
  const INK = '#14161a'
  const face = {
    idle: <>
      <circle className="blink" cx="31" cy="31" r="4.6" fill={INK}/><circle className="blink" cx="51" cy="31" r="4.6" fill={INK}/>
      <path d="M23 20l15-5" stroke={INK} strokeWidth="3.2" strokeLinecap="round"/><path d="M45 21h13" stroke={INK} strokeWidth="3.2" strokeLinecap="round"/>
      <ellipse cx="41" cy="45" rx="3.6" ry="4.6" fill={INK}/></>,
    worried: <>
      <circle cx="31" cy="32" r="4.8" fill={INK}/><circle cx="51" cy="32" r="4.8" fill={INK}/>
      <path d="M24 22l14-2M44 20l14 2" stroke={INK} strokeWidth="3.2" strokeLinecap="round"/>
      <path d="M32 47q4.5-5 9 0t9 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round"/></>,
    happy: <>
      <path d="M25 33q6-9 12 0M45 33q6-9 12 0" stroke={INK} strokeWidth="3.6" fill="none" strokeLinecap="round"/>
      <path d="M31 42q10 12 20 0z" fill={INK}/></>,
    cheer: <>
      <path d="M25 33q6-9 12 0M45 33q6-9 12 0" stroke={INK} strokeWidth="3.6" fill="none" strokeLinecap="round"/>
      <path d="M29 41q12 15 24 0z" fill={INK}/><path d="M35 48q6 4 12 0" stroke="#ff5a47" strokeWidth="3" fill="none" strokeLinecap="round"/></>,
    sleepy: <>
      <path d="M25 32q6 5 12 0M45 32q6 5 12 0" stroke={INK} strokeWidth="3.4" fill="none" strokeLinecap="round"/>
      <path d="M36 46h10" stroke={INK} strokeWidth="3.2" strokeLinecap="round"/></>,
  }[mood]
  const mark = { idle: '?', worried: '?!', happy: '!', cheer: '!', sleepy: 'z' }[mood]
  return (
    <svg viewBox="0 0 92 92" width={size} height={size} className={`${beat ? 'wobble' : ''} ${className}`} role="img" aria-label="Pip, the Wait, what? mascot" style={{ overflow: 'visible' }}>
      <path d="M22 6H60A18 18 0 0 1 78 24V42A18 18 0 0 1 60 60H40L16 78L22 60A18 18 0 0 1 4 42V24A18 18 0 0 1 22 6Z" transform="translate(4 5)" fill="rgba(0,0,0,.45)"/>
      <path d="M22 6H60A18 18 0 0 1 78 24V42A18 18 0 0 1 60 60H40L16 78L22 60A18 18 0 0 1 4 42V24A18 18 0 0 1 22 6Z" fill="#ffe14d" stroke={INK} strokeWidth="3.5" strokeLinejoin="round"/>
      <path d="M14 15q4-5 12-5" stroke="#fff" strokeOpacity=".8" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
      <g style={{ transform: look ? `translate(${look.x * 3.2}px, ${look.y * 2.4}px)` : undefined, transition: 'transform .12s ease-out' }}>{face}</g>
      <text className="bob" x="74" y="9" fontFamily="Caveat, cursive" fontWeight="700" fontSize="26" fill={mood === 'sleepy' ? '#9fb3ff' : mood === 'happy' || mood === 'cheer' ? '#3ddc97' : '#ff5a47'} stroke={INK} strokeWidth="1.2" paintOrder="stroke">{mark}</text>
      {mood === 'cheer' && <><circle cx="4" cy="4" r="2.6" fill="#ff9f1c"/><circle cx="86" cy="40" r="2.2" fill="#4cc2ff"/><circle cx="-2" cy="30" r="2" fill="#3ddc97"/></>}
    </svg>
  )
}
