import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { logoutUser } from '../user'

const TIMEOUT_MS = 5 * 60 * 1000

export default function useSessionTimeout() {
  const navigate = useNavigate()
  const timer = useRef(null)

  const resetTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      logoutUser()
      navigate('/login', { state: { reason: 'Session expired due to inactivity' } })
    }, TIMEOUT_MS)
  }, [navigate])

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (timer.current) clearTimeout(timer.current)
    }
  }, [resetTimer])
}
