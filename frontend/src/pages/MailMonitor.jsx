import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser } from '../user'
import UpiExtractChat from '../components/UpiExtractChat'

export default function MailMonitor() {
  const user = getUser()
  const navigate = useNavigate()
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [hiveStatus, setHiveStatus] = useState('checking')
  const [extractionDismissed, setExtractionDismissed] = useState(false)
  const [lastScannedText, setLastScannedText] = useState('')
  const pasteRef = useRef(null)

  useEffect(() => {
    async function checkHive() {
      try {
        const r = await fetch('/api/health')
        const d = await r.json()
        setHiveStatus(d.hive_connected ? 'live' : 'down')
      } catch { setHiveStatus('down') }
    }
    checkHive()
    const i = setInterval(checkHive, 15000)
    return () => clearInterval(i)
  }, [])

  function loadEmails() {
    setLoading(true)
    fetch(`/api/email/inbox/${user.id}`)
      .then(r => r.json())
      .then(setEmails)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadEmails() }, [user.id])

  async function autoScan(text) {
    if (!text || text.trim().length < 10) return
    setScanning(true)
    setScanResult(null)
    try {
      const resp = await fetch('/api/email/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          sender_email: 'scanned@email',
          subject: 'Pasted Email Scan',
          body: text,
        }),
      })
      const data = await resp.json()
      if (data.is_scam) {
        const upis = data.entities?.upi_ids || []
        const conf = Math.round(data.confidence * 100)
        setScanResult({
          type: 'scam',
          confidence: conf,
          upis,
          scamType: data.scam_type,
          message: `SCAM DETECTED (${conf}%)${upis.length > 0 ? ` — UPI flagged: ${upis.join(', ')}` : ''}`,
          indicators: data.key_indicators || [],
          detection: data,
          needsExtraction: data.needs_upi_extraction && !upis.length,
        })
        setExtractionDismissed(false)
        setLastScannedText(text)
        if (Notification.permission === 'granted') {
          new Notification('H.I.V.E. — Scam Detected!', {
            body: `${data.scam_type?.toUpperCase()} scam (${conf}%)${upis.length > 0 ? `\nUPI blocked: ${upis.join(', ')}` : ''}`,
            tag: 'hive-scam',
          })
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission()
        }
      } else {
        setScanResult({ type: 'safe', message: 'Email appears safe — no scam indicators found.' })
      }
      loadEmails()
    } catch (err) {
      setScanResult({ type: 'error', message: `Scan failed: ${err.message}` })
    } finally {
      setScanning(false)
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData?.getData('text') || ''
    if (text.length > 10) {
      e.preventDefault()
      if (pasteRef.current) pasteRef.current.value = ''
      autoScan(text)
    }
  }

  const scamCount = emails.filter(e => e.is_scam).length
  const safeCount = emails.filter(e => e.is_scam === false).length

  return (
    <div className="min-h-screen bg-[#f0f2f5] bg-grid">
      {/* Header */}
      <div className="h-14 glass flex items-center px-5 gap-3 animate-fade-in-down">
        <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center transition-all">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
        </div>
        <span className="text-sm font-semibold text-slate-700">Email Monitor</span>
        <div className="flex items-center gap-1.5 ml-2">
          <span className={`w-2 h-2 rounded-full ${hiveStatus === 'live' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : hiveStatus === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`} />
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium border ${
            hiveStatus === 'live' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            hiveStatus === 'checking' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
            'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>
            H.I.V.E. {hiveStatus === 'live' ? 'CONNECTED' : hiveStatus === 'checking' ? 'checking...' : 'OFFLINE'}
          </span>
        </div>
        <div className="flex-1" />
        {scamCount > 0 && (
          <span className="text-[10px] bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full font-bold border border-red-500/20 animate-pulse">{scamCount} threat{scamCount > 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="max-w-4xl mx-auto p-5 space-y-5">

        {/* Auto-Scan Paste Zone — just paste, it scans automatically */}
        <div className="relative animate-fade-in-up">
          <div
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
              scanning
                ? 'border-indigo-500/50 bg-indigo-500/5'
                : 'border-gray-200 hover:border-indigo-500/30 bg-gray-50/50'
            }`}
          >
            {scanning ? (
              <div className="flex items-center justify-center gap-3 py-4">
                <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-indigo-400 font-semibold">H.I.V.E. scanning email...</p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                  </svg>
                </div>
                <p className="text-slate-300 font-semibold text-sm">Paste any email here — H.I.V.E. scans automatically</p>
                <p className="text-slate-600 text-xs mt-1">Copy the suspicious email from Gmail and press Ctrl+V anywhere on this page</p>
                <textarea
                  ref={pasteRef}
                  onPaste={handlePaste}
                  placeholder="Ctrl+V to paste email..."
                  rows={1}
                  className="w-full mt-3 px-4 py-3 rounded-xl bg-[#f0f2f5] border border-gray-200 text-slate-700 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition-all resize-none text-center"
                />
              </>
            )}
          </div>
        </div>

        {/* Scan Result Banner */}
        {scanResult && (
          <div className={`p-5 rounded-2xl border animate-fade-in ${
            scanResult.type === 'scam' ? 'bg-red-500/10 border-red-500/30 animate-risk-pulse' :
            scanResult.type === 'safe' ? 'bg-emerald-500/10 border-emerald-500/30' :
            'bg-amber-500/10 border-amber-500/30'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {scanResult.type === 'scam' && (
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
                  </div>
                )}
                {scanResult.type === 'safe' && (
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  </div>
                )}
                <div>
                  <p className={`text-base font-bold ${scanResult.type === 'scam' ? 'text-red-400' : scanResult.type === 'safe' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {scanResult.message}
                  </p>
                  {scanResult.type === 'scam' && scanResult.upis?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {scanResult.upis.map((upi, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 font-mono border border-red-500/20">{upi}</span>
                      ))}
                      <span className="text-xs text-red-400/70 ml-1 self-center">— blocked from payments</span>
                    </div>
                  )}
                  {scanResult.indicators?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {scanResult.indicators.slice(0, 4).map((ind, i) => (
                        <p key={i} className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                          {ind}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => { setScanResult(null); setExtractionDismissed(false) }} className="text-slate-600 hover:text-slate-400 text-xs ml-4">Dismiss</button>
            </div>

            {scanResult.needsExtraction && !extractionDismissed && scanResult.detection && (
              <div className="mt-3">
                <UpiExtractChat
                  detection={scanResult.detection}
                  userId={user.id}
                  originalMessage={lastScannedText}
                  onComplete={(upis) => {
                    setScanResult(prev => ({
                      ...prev,
                      upis,
                      needsExtraction: false,
                      message: `SCAM DETECTED (${prev.confidence}%) — UPI flagged: ${upis.join(', ')}`,
                    }))
                  }}
                  onDismiss={() => setExtractionDismissed(true)}
                />
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 animate-fade-in-up">
          <div className="glass rounded-xl p-5 text-center card-hover">
            <p className="text-3xl font-bold text-slate-700 tabular-nums font-mono">{emails.length}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium uppercase tracking-wide">Total Scanned</p>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 text-center card-hover">
            <p className="text-3xl font-bold text-red-400 tabular-nums font-mono">{scamCount}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium uppercase tracking-wide">Threats Detected</p>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 text-center card-hover">
            <p className="text-3xl font-bold text-emerald-400 tabular-nums font-mono">{safeCount}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium uppercase tracking-wide">Safe Emails</p>
          </div>
        </div>

        {/* Email list */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Loading inbox...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
            </div>
            <p className="text-slate-400 font-medium">No emails scanned yet</p>
            <p className="text-xs text-slate-600 mt-1">Paste a suspicious email above to auto-scan</p>
          </div>
        ) : (
          <div className="space-y-3">
            {emails.map((em, idx) => {
              const isScam = em.is_scam
              const isSelected = selected === em.id
              return (
                <div key={em.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 60}ms` }}>
                  <button
                    onClick={() => setSelected(isSelected ? null : em.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isScam
                        ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                        : 'glass hover:border-indigo-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isScam ? 'bg-red-500/15' : 'bg-emerald-500/10'
                      }`}>
                        {isScam ? (
                          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                        ) : (
                          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-700 truncate">{em.subject}</p>
                          {isScam && (
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                              em.risk_level === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>{em.risk_level}</span>
                          )}
                          {isScam && em.scam_type && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 flex-shrink-0">{em.scam_type.replace(/_/g, ' ')}</span>
                          )}
                          {!isScam && <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20 flex-shrink-0">SAFE</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-mono">From: {em.sender}</p>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">{em.body_preview}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        {em.confidence != null && (
                          <p className={`text-lg font-bold font-mono tabular-nums ${isScam ? 'text-red-400' : 'text-emerald-400'}`}>
                            {Math.round(em.confidence * 100)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  {isSelected && (
                    <div className={`mx-2 p-5 rounded-b-xl border-x border-b space-y-3 animate-fade-in ${
                      isScam ? 'bg-red-500/5 border-red-500/20' : 'bg-[#1e293b]/50 border-gray-200'
                    }`}>
                      {em.explanation && <p className="text-sm text-slate-300 leading-relaxed">{em.explanation}</p>}
                      {em.key_indicators?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Detection Indicators</p>
                          <ul className="space-y-1.5">
                            {em.key_indicators.map((ind, i) => (
                              <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                                <span className={`mt-0.5 flex-shrink-0 ${isScam ? 'text-red-400' : 'text-emerald-400'}`}>
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg>
                                </span>
                                {ind}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {isScam && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/15 text-xs text-red-300 flex items-start gap-2">
                          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                          Any UPIs in this email have been flagged. Model 2 will block payments to these entities.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
