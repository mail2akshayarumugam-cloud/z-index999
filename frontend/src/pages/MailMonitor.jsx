import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser } from '../user'

export default function MailMonitor() {
  const user = getUser()
  const navigate = useNavigate()
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [newEmail, setNewEmail] = useState({ sender: '', subject: '', body: '' })
  const [showCompose, setShowCompose] = useState(false)
  const [hiveStatus, setHiveStatus] = useState('checking')

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

  async function handleScanEmail(e) {
    e.preventDefault()
    if (!newEmail.body.trim()) return
    setScanning(true)
    try {
      await fetch('/api/email/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          sender_email: newEmail.sender || 'unknown@sender.com',
          subject: newEmail.subject || 'No Subject',
          body: newEmail.body,
        }),
      })
      setNewEmail({ sender: '', subject: '', body: '' })
      setShowCompose(false)
      loadEmails()
    } catch {} finally { setScanning(false) }
  }

  const scamCount = emails.filter(e => e.is_scam).length
  const safeCount = emails.filter(e => e.is_scam === false).length

  return (
    <div className="min-h-screen bg-[#0b1120] bg-grid">
      {/* Header */}
      <div className="h-14 glass flex items-center px-5 gap-3 animate-fade-in-down">
        <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center transition-all">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
        </div>
        <span className="text-sm font-semibold text-slate-200">Email Monitor</span>

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
        <button onClick={() => setShowCompose(!showCompose)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Scan Email
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 animate-fade-in-up">
          <div className="glass rounded-xl p-5 text-center card-hover">
            <p className="text-3xl font-bold text-slate-200 tabular-nums font-mono">{emails.length}</p>
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

        {/* Compose */}
        {showCompose && (
          <form onSubmit={handleScanEmail} className="glass-strong rounded-xl p-6 space-y-4 border-indigo-500/20 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <p className="text-sm font-semibold text-indigo-300">Scan a suspicious email</p>
            </div>
            <input type="text" value={newEmail.sender} onChange={e => setNewEmail(p => ({ ...p, sender: e.target.value }))}
              placeholder="Sender email (e.g. alert@fake-bank.tk)"
              className="w-full px-4 py-3 rounded-xl bg-[#0f172a] border border-[#334155] text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all" />
            <input type="text" value={newEmail.subject} onChange={e => setNewEmail(p => ({ ...p, subject: e.target.value }))}
              placeholder="Subject line"
              className="w-full px-4 py-3 rounded-xl bg-[#0f172a] border border-[#334155] text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all" />
            <textarea value={newEmail.body} onChange={e => setNewEmail(p => ({ ...p, body: e.target.value }))}
              placeholder="Paste email body here..."
              rows={5}
              className="w-full px-4 py-3 rounded-xl bg-[#0f172a] border border-[#334155] text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowCompose(false)} className="px-5 py-2.5 rounded-xl border border-[#334155] text-slate-400 text-sm hover:bg-white/5 transition-all">Cancel</button>
              <button type="submit" disabled={scanning || !newEmail.body.trim()}
                className="flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                {scanning ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scanning...</> : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Scan with H.I.V.E.
                  </>
                )}
              </button>
            </div>
          </form>
        )}

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
            <p className="text-xs text-slate-600 mt-1">Click "Scan Email" to analyze a suspicious message</p>
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
                        ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40 hover:bg-red-500/8'
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
                          <p className="text-sm font-medium text-slate-200 truncate">{em.subject}</p>
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
                        <p className="text-[10px] text-slate-600">
                          {em.received_at ? new Date(em.received_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                        </p>
                      </div>
                    </div>
                  </button>

                  {isSelected && (
                    <div className={`mx-2 p-5 rounded-b-xl border-x border-b space-y-3 animate-fade-in ${
                      isScam ? 'bg-red-500/5 border-red-500/20' : 'bg-[#1e293b]/50 border-[#334155]'
                    }`}>
                      {em.explanation && (
                        <p className="text-sm text-slate-300 leading-relaxed">{em.explanation}</p>
                      )}
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
                          Any UPIs, phone numbers, or URLs in this email have been flagged. Model 2 will block payments to these entities.
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
