import { useState, useRef, useEffect } from 'react'
import UpiExtractChat from './UpiExtractChat'

export default function WhatsAppPanel({ user, onAlert, onNotification }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [analyzing, setAnalyzing] = useState(null)
  const [pendingHoneypots, setPendingHoneypots] = useState([])
  const [activeHoneypots, setActiveHoneypots] = useState({})
  const [dismissedSessions, setDismissedSessions] = useState(new Set())
  const chatEndRef = useRef(null)
  const pendingPollRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingHoneypots, activeHoneypots])

  useEffect(() => {
    async function pollPending() {
      try {
        const resp = await fetch('/api/hive/honeypots/pending')
        const data = await resp.json()
        setPendingHoneypots(data || [])
      } catch {}
    }
    pollPending()
    pendingPollRef.current = setInterval(pollPending, 5000)
    return () => clearInterval(pendingPollRef.current)
  }, [])

  async function handleSend() {
    if (!input.trim() || analyzing) return
    const text = input.trim()
    setInput('')

    const msgId = Date.now()
    setMessages(prev => [
      ...prev,
      {
        id: msgId,
        from: 'Unknown Sender',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    setAnalyzing(msgId)

    try {
      const resp = await fetch('/api/hive/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, user_id: user.id }),
      })
      const data = await resp.json()

      setMessages(prev =>
        prev.map(m => (m.id === msgId ? { ...m, analysis: data } : m))
      )

      if (data.is_scam) {
        onAlert?.({
          id: data.detection_id,
          type: data.scam_type,
          confidence: data.confidence,
          risk_level: data.risk_level,
          entities: data.entities,
          explanation: data.explanation,
          timestamp: new Date().toISOString(),
        })
        onNotification?.(data.notification)

        if (data.honeypot_session_id) {
          setActiveHoneypots(prev => ({
            ...prev,
            [msgId]: data.honeypot_session_id,
          }))
        }
      }
    } catch {
      setMessages(prev =>
        prev.map(m => (m.id === msgId ? { ...m, error: true } : m))
      )
    } finally {
      setAnalyzing(null)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function dismissSession(sessionId) {
    setDismissedSessions(prev => new Set([...prev, sessionId]))
  }

  const visiblePending = pendingHoneypots.filter(p => !dismissedSessions.has(p.session_id))

  return (
    <div className="h-full flex flex-col bg-[#0b141a]">
      {/* Header */}
      <div className="h-14 bg-[#1f2c34] flex items-center px-4 gap-3 flex-shrink-0 border-b border-[#2a3942]">
        <div className="w-9 h-9 rounded-full bg-[#2a3942] flex items-center justify-center">
          <svg className="w-5 h-5 text-[#8696a0]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[#e9edef]">Messages</p>
          <p className="text-[11px] text-[#8696a0]">Auto-monitored via H.I.V.E.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-medium">H.I.V.E.</span>
        </div>
        {visiblePending.length > 0 && (
          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold border border-amber-500/30 animate-pulse">
            {visiblePending.length} pending
          </span>
        )}
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ backgroundColor: '#0b141a' }}>
        {messages.length === 0 && visiblePending.length === 0 && (
          <div className="flex justify-center mt-8">
            <div className="bg-[#1d2b36] rounded-lg px-4 py-3 max-w-[300px] text-center">
              <svg className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-[12px] text-[#8696a0] leading-relaxed">
                H.I.V.E. is monitoring WhatsApp via the Chrome extension. Scam detections will appear here automatically.
              </p>
              <p className="text-[10px] text-[#8696a0]/60 mt-2">
                You can also paste messages manually below.
              </p>
            </div>
          </div>
        )}

        {/* Pending honeypots from auto-sync */}
        {visiblePending.map(p => (
          <UpiExtractChat
            key={p.session_id}
            detection={{
              detection_id: p.detection_id,
              scam_type: p.scam_type,
              risk_level: p.risk_level,
              confidence: p.confidence,
            }}
            userId={user.id}
            originalMessage={p.message_preview}
            sessionId={p.session_id}
            onComplete={(upis) => {
              onAlert?.({
                id: p.detection_id,
                type: p.scam_type,
                confidence: p.confidence,
                risk_level: p.risk_level,
                entities: { upi_ids: upis },
                explanation: 'UPI extracted via honeypot',
                timestamp: new Date().toISOString(),
              })
            }}
            onDismiss={() => dismissSession(p.session_id)}
          />
        ))}

        {/* Manually scanned messages */}
        {messages.map(msg => (
          <div key={msg.id}>
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-lg px-3 py-2 bg-[#1f2c34] text-[#e9edef]">
                <p className="text-[11px] text-[#06cf9c] font-medium mb-0.5">{msg.from}</p>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                <p className="text-[10px] text-[#8696a0] text-right mt-1">{msg.time}</p>
              </div>
            </div>

            {analyzing === msg.id && (
              <div className="flex justify-start mt-1 ml-1">
                <div className="bg-[#1f2c34] rounded-lg px-3 py-2 flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  <span className="text-[11px] text-emerald-400">H.I.V.E. scanning...</span>
                </div>
              </div>
            )}

            {msg.analysis && (
              <div className={`mt-1.5 ml-1 max-w-[92%] rounded-lg p-3 border ${
                msg.analysis.is_scam ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  {msg.analysis.is_scam ? (
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  )}
                  <span className={`text-xs font-bold ${msg.analysis.is_scam ? 'text-red-400' : 'text-emerald-400'}`}>
                    {msg.analysis.is_scam ? 'SCAM DETECTED' : 'SAFE'}
                  </span>
                  <span className="text-[10px] text-[#8696a0]">
                    {(msg.analysis.confidence * 100).toFixed(0)}%
                  </span>
                  {msg.analysis.scam_type && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                      {msg.analysis.scam_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                {msg.analysis.is_scam && (
                  <>
                    <p className="text-[12px] text-[#e9edef]/80 leading-relaxed mb-2">{msg.analysis.explanation}</p>
                    {(msg.analysis.entities?.upi_ids?.length > 0 ||
                      msg.analysis.entities?.phone_numbers?.length > 0 ||
                      msg.analysis.entities?.urls?.length > 0) && (
                      <div className="mb-2">
                        <p className="text-[10px] text-red-400/70 font-semibold uppercase mb-1">Flagged Entities</p>
                        <div className="flex flex-wrap gap-1">
                          {msg.analysis.entities.upi_ids?.map((v, i) => (
                            <span key={`u${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">UPI: {v}</span>
                          ))}
                          {msg.analysis.entities.phone_numbers?.map((v, i) => (
                            <span key={`p${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">{v}</span>
                          ))}
                          {msg.analysis.entities.urls?.map((v, i) => (
                            <span key={`r${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-mono truncate max-w-[220px]">{v}</span>
                          ))}
                          {msg.analysis.entities.amounts?.map((v, i) => (
                            <span key={`a${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">{v}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="p-2 rounded bg-red-500/5 border border-red-500/15">
                      <p className="text-[11px] text-red-300">{msg.analysis.notification?.recommended_action}</p>
                    </div>
                    <p className="text-[10px] text-[#8696a0] mt-2">Signal sent to Model 2 — payments to flagged entities will be intercepted.</p>
                  </>
                )}
              </div>
            )}

            {/* Auto-show honeypot for manual scans with no UPI */}
            {msg.analysis?.needs_upi_extraction
              && !msg.analysis.entities?.upi_ids?.length
              && activeHoneypots[msg.id]
              && !dismissedSessions.has(activeHoneypots[msg.id]) && (
              <UpiExtractChat
                detection={msg.analysis}
                userId={user.id}
                originalMessage={msg.text}
                sessionId={activeHoneypots[msg.id]}
                onComplete={(upis) => {
                  setMessages(prev => prev.map(m =>
                    m.id === msg.id
                      ? {
                          ...m,
                          analysis: {
                            ...m.analysis,
                            entities: { ...m.analysis.entities, upi_ids: upis },
                            needs_upi_extraction: false,
                          },
                        }
                      : m
                  ))
                }}
                onDismiss={() => dismissSession(activeHoneypots[msg.id])}
              />
            )}

            {msg.error && (
              <p className="mt-1 ml-1 text-[11px] text-red-400">Analysis failed — is the backend running?</p>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-[#1f2c34] px-3 py-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste a suspicious message (or H.I.V.E. auto-detects via extension)..."
          rows={1}
          className="flex-1 bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] text-[13px] rounded-lg px-3 py-2.5 resize-none focus:outline-none max-h-28 overflow-y-auto"
          style={{ minHeight: '40px' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || analyzing !== null}
          className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#06cf9c] flex items-center justify-center transition-colors disabled:opacity-40 flex-shrink-0"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )
}
