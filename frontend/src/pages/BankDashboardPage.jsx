import { useState, useEffect } from 'react'

const SUSPICIOUS_UPIS = ['vikram.invest@ybl', 'suresh.mule99@ybl']

export default function BankDashboardPage() {
  const [signals, setSignals] = useState([])
  const [upiChecks, setUpiChecks] = useState({})
  const [loading, setLoading] = useState(true)
  const [recentTxn, setRecentTxn] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const upiResults = {}
        for (const upi of SUSPICIOUS_UPIS) {
          const resp = await fetch(`/api/risk/signals/upi/${encodeURIComponent(upi)}`)
          upiResults[upi] = await resp.json()
        }
        setUpiChecks(upiResults)

        const sigResp = await fetch('/api/risk/signals/user-vikram?hours=168')
        if (sigResp.ok) setSignals(await sigResp.json())
      } catch {} finally { setLoading(false) }
    }
    load()
  }, [])

  async function simulateHighRiskTxn() {
    setRecentTxn(null)
    try {
      const resp = await fetch('/api/transactions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'user-neha', beneficiary_upi: 'vikram.invest@ybl', amount: 25000, device_id: 'dev-neha-iphone' }),
      })
      if (resp.ok) setRecentTxn(await resp.json())
    } catch {}
  }

  if (loading) return <div className="text-center py-12 text-slate-500">Loading dashboard...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Bank / Fraud Operations</h1>
          <p className="text-sm text-slate-500 mt-1">Simulated banking service dashboard</p>
        </div>
        <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full font-medium">Operations View</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Alerts', value: Object.values(upiChecks).filter(u => u.is_flagged).length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
          { label: 'Flagged UPIs', value: Object.values(upiChecks).reduce((a, u) => a + u.signal_count, 0), color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
          { label: 'Model Version', value: 'ml-v1', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
          { label: 'Protection', value: 'Active', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} border rounded-xl p-4 text-center`}>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Suspicious UPI IDs */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
        <h2 className="font-semibold text-slate-200 mb-4">Suspicious UPI IDs (H.I.V.E. Flagged)</h2>
        <div className="space-y-3">
          {SUSPICIOUS_UPIS.map(upi => {
            const check = upiChecks[upi]
            if (!check) return null
            return (
              <div key={upi} className={`p-4 rounded-lg border ${check.is_flagged ? 'bg-red-500/5 border-red-500/20' : 'bg-[#0f172a] border-[#334155]'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${check.is_flagged ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                    <span className="font-mono text-sm text-slate-200">{upi}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {check.is_flagged ? (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500 text-white">FLAGGED ({check.signal_count})</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400">CLEAR</span>
                    )}
                  </div>
                </div>
                {check.signals?.length > 0 && (
                  <div className="mt-2 ml-6 text-xs text-slate-500 space-y-1">
                    {check.signals.map((s, i) => (
                      <p key={i}>Source: {s.source} | Type: {s.scam_type} | Severity: <span className="font-bold text-red-400">{s.severity}</span></p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Simulate High-Risk Transaction */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-200">High-Risk Transaction Simulator</h2>
          <button onClick={simulateHighRiskTxn}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">
            Simulate Attack
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Simulates: Rs 25,000 from Neha (scam victim) to vikram.invest@ybl (H.I.V.E.-flagged investment scam)</p>

        {recentTxn && (
          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#334155] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Transaction {recentTxn.transaction_id.slice(0, 8)}...</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                recentTxn.risk_evaluation.risk_level === 'CRITICAL' ? 'bg-red-600 text-white' :
                recentTxn.risk_evaluation.risk_level === 'HIGH' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
              }`}>{recentTxn.risk_evaluation.risk_level}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-xs text-slate-500">Risk Score</p><p className="text-2xl font-bold text-red-400">{recentTxn.risk_evaluation.risk_score}</p></div>
              <div><p className="text-xs text-slate-500">Decision</p><p className="text-2xl font-bold text-red-400">{recentTxn.risk_evaluation.decision}</p></div>
              <div><p className="text-xs text-slate-500">Velocity</p><p className="text-2xl font-bold text-amber-400">{recentTxn.risk_evaluation.risk_velocity?.trend?.replace(/_/g, ' ') || '-'}</p></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-1">Risk Reasons:</p>
              <ul className="text-xs text-slate-500 space-y-0.5">
                {recentTxn.risk_evaluation.reasons.map((r, i) => <li key={i}>- {r}</li>)}
              </ul>
            </div>
            {recentTxn.risk_evaluation.hive_signals_used?.length > 0 && (
              <div className="p-2 rounded bg-red-500/5 border border-red-500/20 text-xs text-red-400">
                H.I.V.E. Signals: {recentTxn.risk_evaluation.hive_signals_used.map(s => `${s.entity_value} (${s.severity})`).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audit History */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
        <h2 className="font-semibold text-slate-200 mb-4">Recent Audit Trail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0f172a]">
              <tr className="text-slate-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Decision</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155] text-slate-400">
              {[
                { time: '09:12', event: 'Transaction HELD', user: 'Neha', decision: 'HOLD', details: 'Rs 25,000 to vikram.invest@ybl — H.I.V.E. flagged as investment_scam' },
                { time: '09:10', event: 'H.I.V.E. Alert', user: 'Neha', decision: '-', details: 'Scam message from +919900088877 — impersonates HDFC Bank, 93% confidence' },
                { time: '09:05', event: 'Email Changed', user: 'Vikram', decision: '-', details: 'Changed to proton.me — obfuscation pattern' },
                { time: '09:02', event: 'Transaction ALLOWED', user: 'Arjun', decision: 'ALLOW', details: 'Score 0.0 — Rs 600 to Neha (verified friend)' },
                { time: '08:55', event: 'Transaction ALLOWED', user: 'Arjun', decision: 'ALLOW', details: 'Score 0.0 — Rs 8,500 rent to verified PG landlord' },
              ].map((row, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-mono text-xs">{row.time}</td>
                  <td className="px-4 py-3 font-medium text-slate-300">{row.event}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.user}</td>
                  <td className="px-4 py-3">
                    {row.decision !== '-' && (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.decision === 'HOLD' ? 'bg-red-600 text-white' : row.decision === 'ALLOW' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-300'}`}>{row.decision}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
