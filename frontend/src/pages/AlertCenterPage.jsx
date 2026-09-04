import { useState, useEffect } from 'react'
import UpiExtractChat from '../components/UpiExtractChat'

const USER_ID = 'user-arjun'
const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-600/10', border: 'border-red-600/30', text: 'text-red-300', badge: 'bg-red-600 text-white' },
  high: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500 text-white' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', badge: 'bg-amber-500 text-white' },
  info: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', badge: 'bg-slate-600 text-slate-200' },
}

export default function AlertCenterPage() {
  const [notifications, setNotifications] = useState([])
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [hiveMessage, setHiveMessage] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [extractionDismissed, setExtractionDismissed] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/notifications/${USER_ID}`).then(r => r.json()),
      fetch(`/api/risk/signals/${USER_ID}?hours=72`).then(r => r.json()),
    ]).then(([n, s]) => { setNotifications(n); setSignals(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAnalyze() {
    if (!hiveMessage.trim()) return
    setAnalyzing(true)
    setAnalysisResult(null)
    try {
      const resp = await fetch('/api/hive/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: hiveMessage, user_id: USER_ID }),
      })
      const data = await resp.json()
      setAnalysisResult(data)
      const nResp = await fetch(`/api/notifications/${USER_ID}`)
      setNotifications(await nResp.json())
    } catch {} finally { setAnalyzing(false) }
  }

  if (loading) return <div className="text-center py-12 text-slate-500">Loading alerts...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">H.I.V.E. Alert Center</h1>
        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full font-medium">Model 1 — Scam Detection</span>
      </div>

      {/* Message Analyzer */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
        <h2 className="font-semibold text-slate-200 mb-3">Test H.I.V.E. Scanner</h2>
        <p className="text-sm text-slate-500 mb-3">Paste a suspicious message to see H.I.V.E. analyze it in real time</p>
        <textarea value={hiveMessage} onChange={e => setHiveMessage(e.target.value)}
          placeholder="e.g. URGENT! Your SBI account is blocked. Transfer Rs5000 to verify@paytm immediately!"
          className="w-full px-4 py-3 rounded-lg bg-[#0f172a] border border-[#334155] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 h-24 resize-none" />
        <button onClick={handleAnalyze} disabled={analyzing || !hiveMessage.trim()}
          className="mt-3 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors disabled:opacity-50">
          {analyzing ? 'Analyzing...' : 'Scan with H.I.V.E.'}
        </button>

        {analysisResult && (
          <div className={`mt-4 p-4 rounded-lg border ${analysisResult.is_scam ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${analysisResult.is_scam ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                {analysisResult.is_scam ? 'SCAM DETECTED' : 'SAFE'}
              </span>
              <span className="text-xs text-slate-500">Confidence: {(analysisResult.confidence * 100).toFixed(0)}%</span>
            </div>
            <p className="text-sm text-slate-300">{analysisResult.explanation}</p>
            {analysisResult.notification && (
              <div className="mt-3 p-3 rounded bg-[#0f172a] text-xs">
                <p className="text-indigo-400 font-semibold">Notification sent to user + Bank Risk Signal created</p>
                <p className="text-slate-500 mt-1">{analysisResult.notification.title}</p>
              </div>
            )}

            {analysisResult.is_scam && analysisResult.needs_upi_extraction && !analysisResult.entities?.upi_ids?.length && !extractionDismissed && (
              <div className="mt-3">
                <UpiExtractChat
                  detection={analysisResult}
                  userId={USER_ID}
                  originalMessage={hiveMessage}
                  onComplete={(upis) => {
                    setAnalysisResult(prev => ({ ...prev, entities: { ...prev.entities, upi_ids: upis }, needs_upi_extraction: false }))
                    fetch(`/api/risk/signals/${USER_ID}?hours=72`).then(r => r.json()).then(setSignals).catch(() => {})
                  }}
                  onDismiss={() => setExtractionDismissed(true)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notifications */}
      <div>
        <h2 className="font-semibold text-slate-200 mb-4">Alerts ({notifications.length})</h2>
        {notifications.length === 0 ? (
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-8 text-center text-slate-500">No alerts yet. Try scanning a message above.</div>
        ) : (
          <div className="space-y-3">
            {notifications.map(n => {
              const s = SEVERITY_STYLES[n.severity] || SEVERITY_STYLES.info
              return (
                <div key={n.id} className={`${s.bg} border ${s.border} rounded-xl p-4`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${s.badge}`}>{n.severity}</span>
                        <span className="text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <h3 className={`font-semibold ${s.text}`}>{n.title}</h3>
                      <p className="text-sm text-slate-400 mt-1">{n.body}</p>
                      {n.recommended_action && (
                        <div className="mt-2 p-2 rounded bg-[#0f172a]/50 text-xs text-slate-500">
                          <span className="font-semibold text-slate-400">Recommended: </span>{n.recommended_action}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Risk Signals Bridge */}
      {signals.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-200 mb-4">Banking Risk Signals (H.I.V.E. to Model 2)</h2>
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0f172a]">
                <tr className="text-slate-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">Entity</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Severity</th>
                  <th className="px-4 py-3 text-left">Scam Type</th>
                  <th className="px-4 py-3 text-left">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {signals.map(s => (
                  <tr key={s.id} className="text-slate-300">
                    <td className="px-4 py-3 font-mono text-xs">{s.entity_value}</td>
                    <td className="px-4 py-3">{s.entity_type}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${s.severity === 'critical' ? 'bg-red-600 text-white' : s.severity === 'high' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>{s.severity}</span></td>
                    <td className="px-4 py-3">{s.scam_type || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{s.created_at ? new Date(s.created_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
