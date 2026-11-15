import { useCallback, useEffect, useRef, useState } from 'react'
import { connect } from './connection.js'
import { COOLDOWN_MS } from './kinds.js'
import { getStudentId, recordTap, rememberAsked, store } from './storage.js'

export function useSession(code) {
  const studentId = useRef(getStudentId()).current
  const [sessionId, setSessionId] = useState(null)   // welcome.sessionId is a PROPOSED addition; falls back to the code
  const [status, setStatus] = useState('connecting')   // connecting | live | reconnecting | bad_code
  const [questions, setQuestions] = useState([])
  const [lines, setLines] = useState([])                // {text, final, startSec}
  const [fix, setFix] = useState(null)                  // moment pushed by host
  const [poll, setPoll] = useState(null)
  const [meter, setMeter] = useState(null)
  const [cool, setCool] = useState({})                  // kind -> epoch ms until which the button is cooling
  const conn = useRef(null)
  const lastSec = useRef(0)

  useEffect(() => {
    const c = connect({
      code, studentId, onStatus: setStatus,
      onMessage: m => {
        const d = m.payload && typeof m.payload === 'object' ? { ...m, ...m.payload } : m // tolerate {type,payload} or flat
        switch (d.type) {
          case 'welcome': if (d.sessionId) setSessionId(d.sessionId); if (d.studentId && d.studentId !== studentId) { store.set('pulse.studentId', d.studentId) } break
          case 'questions': setQuestions(d.list || []); break
          case 'transcript':
            lastSec.current = d.startSec ?? lastSec.current
            setLines(prev => {
              const rest = prev.filter(l => !(l.startSec === d.startSec))
              return [...rest, { text: d.text, final: !!d.final, startSec: d.startSec }].sort((a, b) => a.startSec - b.startSec).slice(-40)
            }); break
          case 'push_fix': setFix(d.moment); break
          case 'poll': setPoll(d); break
          case 'meter': setMeter(d); break
          default: break
        }
      },
    })
    conn.current = c
    return () => c.close()
  }, [code, studentId])

  const react = useCallback(kind => {
    const now = Date.now()
    if ((cool[kind] || 0) > now) return false
    setCool(c => ({ ...c, [kind]: now + COOLDOWN_MS }))
    conn.current?.send({ type: 'react', kind })       // no timestamp: server stamps it
    recordTap(code, kind, lastSec.current)
    return true
  }, [cool, code])

  const ask = useCallback(text => { const t = text.trim(); if (!t) return; conn.current?.send({ type: 'question', text: t.slice(0, 280) }); rememberAsked(code, t) }, [code])
  const upvote = useCallback(questionId => conn.current?.send({ type: 'upvote', questionId }), [])
  const answer = useCallback((momentId, qIndex, choice) => conn.current?.send({ type: 'quiz_answer', momentId, qIndex, choice }), [])

  return { studentId, sessionId, status, questions, lines, fix, poll, meter, cool, react, ask, upvote, answer, dismissFix: () => setFix(null), dismissPoll: () => setPoll(null) }
}
