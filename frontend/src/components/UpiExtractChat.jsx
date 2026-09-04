import { useState, useRef, useEffect } from 'react'

export default function UpiExtractChat({ detection, userId, originalMessage, sessionId: propSessionId, onComplete, onDismiss }) {
  const [sessionId, setSessionId] = useState(propSessionId || null)
  const [state, setState] = useState('init')
  const [persona, setPersona] = useState('')
  const [messages, setMessages] = useState([])
  const [extractedUpis, setExtractedUpis] = useState([])
  const [intelligence, setIntelligence] = useState([])
  const [turn, setTurn] = useState(0)
  const [maxTurns, setMaxTurns] = useState(5)
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    startSession()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  function applyResponse(data) {
    if (data.error) return
    if (data.session_id) setSessionId(data.session_id)
    setState(data.state)
    if (data.persona) setPersona(data.persona)
    setMessages(data.messages || [])
    setExtractedUpis(data.extracted_upis || [])
    setIntelligence(data.intelligence || [])
    setTurn(data.turn || 0)
    setMaxTurns(data.max_turns || 5)

    if (data.state === 'extracted' && data.extracted_upis?.length) {
      onComplete?.(data.extracted_upis)
      if (pollRef.current) clearInterval(pollRef.current)
    }
    if (['exhausted', 'cancelled', 'error'].includes(data.state)) {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }

  async function startSession() {
    setLoading(true)
    try {
      let data
      if (propSessionId) {
        const resp = await fetch(`/api/hive/extract-upi/${propSessionId}`)
        data = await resp.json()
        if (data.state === 'active') startPolling(propSessionId)
      } else {
        const resp = await fetch('/api/hive/extract-upi/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            detection_id: detection.detection_id,
            user_id: userId,
            scam_type: detection.scam_type,
            risk_level: detection.risk_level,
            confidence: detection.confidence,
            original_message: originalMessage || '',
          }),
        })
        data = await resp.json()
      }
      applyResponse(data)
    } catch {
      setState('error')
    } finally {
      setLoading(false)
    }
  }

  async function sendConsent(consented) {
    setLoading(true)
    try {
      const resp = await fetch('/api/hive/extract-upi/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, consented }),
      })
      const data = await resp.json()
      applyResponse(data)

      if (consented && data.state === 'active' && data.session_id) {
        startPolling(data.session_id)
      }
      if (!consented) {
        setTimeout(() => onDismiss?.(), 2000)
      }
    } catch {
      setState('error')
    } finally {
      setLoading(false)
    }
  }

  function startPolling(sid) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`/api/hive/extract-upi/poll/${sid}`, { method: 'POST' })
        const data = await resp.json()
        applyResponse(data)
      } catch {}
    }, 3000)
  }

  const finished = ['extracted', 'exhausted', 'cancelled', 'error'].includes(state)

  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-[#0b141a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1f2c34] border-b border-[#2a3942]">
        <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-semibold text-amber-400">H.I.V.E. Honeypot</p>
          {persona && <p className="text-[10px] text-[#8696a0]">Persona: {persona}</p>}
        </div>
        {state === 'active' && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] text-amber-400 font-medium">LIVE</span>
          </div>
        )}
        {turn > 0 && (
          <span className="text-[10px] text-[#8696a0] font-mono">{turn}/{maxTurns}</span>
        )}
        {finished && (
          <button onClick={onDismiss} className="text-[10px] text-[#8696a0] hover:text-white transition-colors ml-2">
            Close
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="max-h-80 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((msg, i) => {
          if (msg.role === 'system') {
            return (
              <div key={i} className="flex justify-center">
                <div className="bg-[#1d2b36] rounded-lg px-3 py-2 max-w-[90%] text-center">
                  <p className="text-[11px] text-[#8696a0] leading-relaxed whitespace-pre-wrap"
                     dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-amber-400">$1</strong>') }}
                  />
                </div>
              </div>
            )
          }

          if (msg.role === 'scammer') {
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-3 py-2 bg-[#1f2c34] text-[#e9edef]">
                  <p className="text-[10px] text-red-400 font-semibold mb-0.5">Scammer</p>
                  <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            )
          }

          if (msg.role === 'persona') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg px-3 py-2 bg-[#005c4b] text-[#e9edef]">
                  <p className="text-[10px] text-emerald-300 font-semibold mb-0.5">{msg.persona || persona} (H.I.V.E.)</p>
                  <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            )
          }

          return null
        })}

        {(loading || state === 'active') && !finished && (
          <div className="flex justify-center">
            <div className="bg-[#1d2b36] rounded-lg px-3 py-2 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-[10px] text-amber-400">
                {state === 'active' ? 'Monitoring conversation...' : 'Connecting to H.I.V.E....'}
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Intelligence sidebar */}
      {intelligence.length > 0 && (
        <div className="px-3 py-2 border-t border-[#2a3942] bg-[#111b21]">
          <p className="text-[9px] text-[#8696a0] uppercase font-bold tracking-wider mb-1">Extracted Intelligence</p>
          <div className="flex flex-wrap gap-1">
            {intelligence.map((item, i) => (
              <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                item.type === 'upi_id' ? 'bg-red-500/20 text-red-300' :
                item.type === 'phone_number' ? 'bg-amber-500/20 text-amber-300' :
                item.type === 'url' ? 'bg-orange-500/20 text-orange-300' :
                'bg-purple-500/20 text-purple-300'
              }`}>
                {item.type === 'upi_id' ? 'UPI: ' : ''}{item.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Consent buttons */}
      {state === 'consent_pending' && !loading && (
        <div className="px-3 py-2.5 border-t border-[#2a3942] flex gap-2">
          <button
            onClick={() => sendConsent(true)}
            className="flex-1 py-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors border border-amber-500/30"
          >
            Yes, engage scammer
          </button>
          <button
            onClick={() => sendConsent(false)}
            className="flex-1 py-2.5 rounded-lg bg-[#2a3942] hover:bg-[#374955] text-[#8696a0] text-xs transition-colors"
          >
            No thanks
          </button>
        </div>
      )}

      {/* Success banner */}
      {state === 'extracted' && extractedUpis.length > 0 && (
        <div className="px-3 py-3 border-t border-emerald-500/20 bg-emerald-500/10">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-[12px] text-emerald-400 font-bold">
                UPI Extracted: {extractedUpis.join(', ')}
              </p>
              <p className="text-[10px] text-emerald-400/70 mt-0.5">
                Flagged in Scam Shield — Model 2 will block all payments to this address.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="px-3 py-3 border-t border-red-500/20 bg-red-500/10">
          <p className="text-[11px] text-red-400">
            Could not connect to H.I.V.E. honeypot. Ensure H.I.V.E. (port 8000) and Ollama are running.
          </p>
        </div>
      )}
    </div>
  )
}
