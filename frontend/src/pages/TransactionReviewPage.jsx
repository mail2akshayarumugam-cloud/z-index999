import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const RISK_COLORS = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#dc2626' }
const RISK_BG = { LOW: 'bg-green-500/10 border-green-500/30', MEDIUM: 'bg-amber-500/10 border-amber-500/30', HIGH: 'bg-red-500/10 border-red-500/30', CRITICAL: 'bg-red-600/10 border-red-600/30' }
const RISK_TEXT = { LOW: 'text-green-400', MEDIUM: 'text-amber-400', HIGH: 'text-red-400', CRITICAL: 'text-red-300' }

function RiskBar({ label, value, max = 100 }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = pct >= 80 ? '#dc2626' : pct >= 60 ? '#ef4444' : pct >= 40 ? '#f59e0b' : '#22c55e'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-medium">{Math.round(value)}</span>
      </div>
      <div className="h-2.5 bg-[#0f172a] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export default function TransactionReviewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { preview, recipientName, userId } = location.state || {}
  const [phase, setPhase] = useState('analyzing')
  const [commitResult, setCommitResult] = useState(null)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!preview) { navigate('/send'); return }
    const timer = setTimeout(() => setPhase('result'), 2000)
    return () => clearTimeout(timer)
  }, [preview, navigate])

  if (!preview) return null
  const risk = preview.risk_evaluation
  const level = risk.risk_level
  const features = risk.features_used || {}

  async function handleCommit(overrideReason) {
    setCommitting(true)
    setError('')
    try {
      const resp = await fetch('/api/transactions/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: preview.transaction_id, user_id: userId, override_reason: overrideReason || undefined }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Commit failed')
      setCommitResult(data)
      setPhase('complete')
    } catch (err) {
      setError(err.message)
    } finally {
      setCommitting(false)
    }
  }

  if (phase === 'complete' && commitResult) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-6">
        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${commitResult.status === 'committed' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          {commitResult.status === 'committed' ? (
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          )}
        </div>
        <h1 className="text-2xl font-bold">{commitResult.status === 'committed' ? 'Payment Successful' : 'Payment Blocked'}</h1>
        <p className="text-slate-400">Rs {parseFloat(preview.amount).toLocaleString('en-IN')} to {preview.beneficiary_upi}</p>
        {commitResult.status === 'committed' && <p className="text-sm text-slate-500">Balance remaining: Rs {parseFloat(commitResult.balance_remaining).toLocaleString('en-IN')}</p>}
        {commitResult.status === 'blocked' && <p className="text-sm text-red-400">{commitResult.message}</p>}
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium transition-colors">Back to Home</button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Transaction Summary */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Transaction Summary</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-slate-500">Recipient</span><p className="text-slate-200 font-medium mt-0.5">{recipientName || preview.beneficiary_name || 'Unknown'}</p></div>
          <div><span className="text-slate-500">UPI ID</span><p className="text-slate-200 font-mono mt-0.5">{preview.beneficiary_upi}</p></div>
          <div><span className="text-slate-500">Amount</span><p className="text-2xl font-bold text-slate-100 mt-0.5">Rs {parseFloat(preview.amount).toLocaleString('en-IN')}</p></div>
          <div><span className="text-slate-500">Status</span><p className="mt-0.5">{preview.is_new_beneficiary ? <span className="text-amber-400 font-medium">New Beneficiary</span> : <span className="text-green-400 font-medium">Known Contact</span>}</p></div>
        </div>
      </div>

      {/* Security Analysis */}
      {phase === 'analyzing' ? (
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin" />
            <svg className="absolute inset-3 w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-200">Checking Transaction Security...</h3>
          <p className="text-sm text-slate-500 mt-2">Model 2 is analyzing 30 risk features</p>
          <div className="mt-4 flex justify-center gap-1">
            {['H.I.V.E. Intelligence', 'Behavioral Analysis', 'Device Trust', 'Network Graph'].map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-400 animate-pulse" style={{ animationDelay: `${i * 300}ms` }}>{s}</span>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Risk Result */}
          <div className={`border rounded-xl p-5 ${RISK_BG[level]}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${level === 'LOW' ? 'bg-green-500/20' : level === 'MEDIUM' ? 'bg-amber-500/20' : 'bg-red-500/20'}`}>
                  {level === 'LOW' ? (
                    <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  ) : (
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  )}
                </div>
                <div>
                  <h3 className={`text-xl font-bold ${RISK_TEXT[level]}`}>
                    {level === 'LOW' ? 'Payment Appears Safe' : level === 'MEDIUM' ? 'Additional Verification Required' : level === 'HIGH' ? 'Payment Paused for Protection' : 'Payment Temporarily Held'}
                  </h3>
                  <p className="text-sm text-slate-400">Risk Score: {risk.risk_score}/100 | Model: {risk.model_version}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${level === 'LOW' ? 'bg-green-500/20 text-green-300' : level === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' : level === 'HIGH' ? 'bg-red-500/20 text-red-300' : 'bg-red-600/30 text-red-200'}`}>{level}</span>
            </div>

            {/* Risk Score Bar */}
            <div className="mb-4">
              <div className="h-3 bg-[#0f172a]/50 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${risk.risk_score}%`, backgroundColor: RISK_COLORS[level] }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                <span>0 Safe</span><span>40</span><span>70</span><span>90</span><span>100 Critical</span>
              </div>
            </div>

            {/* Risk Velocity */}
            {risk.risk_velocity && risk.risk_velocity.velocity_score > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-[#0f172a]/50">
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span className="text-slate-300 font-medium">Risk Velocity: {risk.risk_velocity.trend.replace(/_/g, ' ')}</span>
                  <span className="text-slate-500">({risk.risk_velocity.signal_count} signals accumulated)</span>
                </div>
              </div>
            )}

            {/* Reasons */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-300">Why this payment was flagged:</p>
              {risk.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 ${RISK_TEXT[level]}`}>&#8226;</span>
                  <span className="text-slate-300">{r}</span>
                </div>
              ))}
            </div>

            {/* H.I.V.E. Signals */}
            {risk.hive_signals_used?.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">H.I.V.E. Intelligence</p>
                {risk.hive_signals_used.map((s, i) => (
                  <div key={i} className="text-sm text-red-300">
                    {s.entity_type}: <span className="font-mono">{s.entity_value}</span> — {s.scam_type} ({s.severity})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk Explanation Bars */}
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
            <h3 className="font-semibold text-slate-200 mb-4">Risk Breakdown</h3>
            <div className="space-y-3">
              <RiskBar label="Transaction Amount" value={Math.min((features.amount_to_avg_ratio || 0) * 10, 100)} />
              <RiskBar label="Beneficiary Risk" value={features.is_new_beneficiary ? 80 : features.beneficiary_verified ? 10 : 50} />
              <RiskBar label="Behavior Anomaly" value={Math.min(((features.amount_to_max_ratio || 0) - 1) * 30, 100)} max={100} />
              <RiskBar label="H.I.V.E. Intelligence" value={features.hive_recipient_flagged ? (features.hive_signal_severity || 1) * 25 : 0} />
              <RiskBar label="Device Trust" value={features.is_new_device ? 70 : features.device_trusted ? 5 : 40} />
              <RiskBar label="Account Events" value={Math.min((features.account_events_48h || 0) * 25, 100)} />
            </div>
          </div>

          {/* Decision Buttons */}
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
            {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>}

            {level === 'LOW' && (
              <div className="text-center space-y-4">
                <p className="text-green-400 font-medium">This payment appears safe</p>
                <button onClick={() => handleCommit()} disabled={committing}
                  className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-lg transition-colors disabled:opacity-50">
                  {committing ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            )}

            {level === 'MEDIUM' && (
              <div className="text-center space-y-4">
                <p className="text-amber-400 font-medium">Additional verification required</p>
                <button onClick={() => handleCommit('User verified via OTP')} disabled={committing}
                  className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors disabled:opacity-50">
                  {committing ? 'Verifying...' : 'Verify and Continue'}
                </button>
                <button onClick={() => navigate('/')} className="w-full py-3 rounded-xl border border-[#334155] text-slate-400 hover:bg-[#334155] transition-colors">Cancel Payment</button>
              </div>
            )}

            {level === 'HIGH' && (
              <div className="text-center space-y-4">
                <p className="text-red-400 font-medium">Payment paused for your protection</p>
                <button onClick={() => handleCommit('Verified recipient independently')} disabled={committing}
                  className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-50">
                  {committing ? 'Verifying...' : 'Verify Recipient and Pay'}
                </button>
                <button onClick={() => navigate('/')} className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">Cancel Payment</button>
              </div>
            )}

            {level === 'CRITICAL' && (
              <div className="text-center space-y-4">
                <div className="p-4 rounded-lg bg-red-600/10 border border-red-600/30">
                  <p className="text-red-300 font-semibold">This payment has been temporarily held</p>
                  <p className="text-sm text-red-400 mt-2">Our fraud detection system has identified multiple high-severity risk indicators. This transaction cannot proceed without manual review.</p>
                </div>
                <button onClick={() => handleCommit()} disabled={committing}
                  className="w-full py-3.5 rounded-xl bg-[#334155] text-slate-400 cursor-not-allowed opacity-50" disabled>
                  Payment Held — Requires Manual Review
                </button>
                <button onClick={() => navigate('/')} className="w-full py-3 rounded-xl border border-[#334155] text-slate-400 hover:bg-[#334155] transition-colors">Return to Home</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
