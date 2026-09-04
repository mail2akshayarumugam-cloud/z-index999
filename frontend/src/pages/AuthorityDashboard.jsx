import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser, logoutUser } from '../user'

const RISK_COLORS = {
  LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#dc2626',
}

function MiniGauge({ score, level, size = 64 }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(Math.max(score / 100, 0), 1)
  const offset = circumference * (1 - pct)
  const color = RISK_COLORS[level] || '#6366f1'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-lg font-bold tabular-nums font-mono" style={{ color }}>{score}%</p>
      </div>
    </div>
  )
}

export default function AuthorityDashboard() {
  const user = getUser()
  const navigate = useNavigate()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [acting, setActing] = useState(false)
  const [actionResult, setActionResult] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const loadPending = useCallback(() => {
    setLoading(true)
    fetch(`/api/authority/pending?authority_id=${user.id}`)
      .then(r => { if (!r.ok) throw new Error('Forbidden'); return r.json() })
      .then(setPending)
      .catch(() => setPending([]))
      .finally(() => setLoading(false))
  }, [user.id])

  useEffect(() => { loadPending() }, [loadPending])

  useEffect(() => {
    const interval = setInterval(loadPending, 10000)
    return () => clearInterval(interval)
  }, [loadPending])

  async function handleAction(txnId, action) {
    setActing(true)
    setActionResult(null)
    try {
      const resp = await fetch(`/api/authority/${txnId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authority_id: user.id,
          reason: action === 'reject' ? (rejectReason || 'Rejected by authority') : 'Approved by authority after review',
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Failed')
      setActionResult({ action, ...data })
      setSelected(null)
      setRejectReason('')
      loadPending()
    } catch (err) {
      setActionResult({ error: err.message })
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] bg-grid">
      <div className="bg-glow-red">
        {/* Header */}
        <div className="h-14 bg-gray-50/80 backdrop-blur-md border-b border-[#1e293b] flex items-center px-4 gap-3 sticky top-0 z-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <span className="text-sm font-semibold text-slate-300">Authority Dashboard</span>
          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full font-bold border border-amber-500/20">CFO</span>
          {pending.length > 0 && (
            <span className="text-[10px] bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full font-bold animate-pulse border border-red-500/20">
              {pending.length} pending
            </span>
          )}
          <div className="flex-1" />
          <span className="text-[11px] text-slate-400">{user.name}</span>
          <button onClick={() => { logoutUser(); navigate('/login') }} className="text-[11px] text-slate-500 hover:text-slate-300 ml-2 transition-colors">Logout</button>
        </div>

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass rounded-xl p-5 text-center animate-fade-in-up border-t-2 border-t-red-500/50">
              <p className="text-4xl font-bold text-red-400 tabular-nums font-mono">{pending.length}</p>
              <p className="text-xs text-slate-400 mt-1.5">Awaiting Authorization</p>
            </div>
            <div className="glass rounded-xl p-5 text-center animate-fade-in-up delay-100 border-t-2 border-t-amber-500/50">
              <p className="text-2xl font-bold text-amber-400 tabular-nums font-mono">
                ₹{pending.reduce((s, t) => s + parseFloat(t.amount), 0).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-slate-400 mt-1.5">Total Amount at Risk</p>
            </div>
            <div className="glass rounded-xl p-5 text-center animate-fade-in-up delay-200 border-t-2 border-t-indigo-500/50">
              <p className="text-xl font-bold text-indigo-400">Model 2</p>
              <p className="text-xs text-slate-400 mt-1.5">UPI Random Forest</p>
            </div>
          </div>

          {/* Action result */}
          {actionResult && (
            <div className={`p-4 rounded-xl border animate-fade-in-down ${actionResult.error ? 'bg-red-500/10 border-red-500/30' : actionResult.action === 'approve' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              {actionResult.error ? (
                <p className="text-sm text-red-400">{actionResult.error}</p>
              ) : actionResult.action === 'approve' ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-400">Transaction Approved</p>
                    <p className="text-xs text-slate-400 mt-0.5">₹{parseFloat(actionResult.amount).toLocaleString('en-IN')} released. Approved by {actionResult.approved_by}.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-400">Transaction Rejected</p>
                    <p className="text-xs text-slate-400 mt-0.5">Rejected by {actionResult.rejected_by}. Funds returned to sender.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pending list */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              {pending.length > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  {pending.length} Transaction{pending.length > 1 ? 's' : ''} Require Attention
                </>
              ) : 'No Pending Transactions'}
            </h2>

            {loading ? (
              <div className="text-center py-16">
                <div className="w-10 h-10 mx-auto border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
                <p className="text-slate-500 text-sm">Loading transactions...</p>
              </div>
            ) : pending.length === 0 ? (
              <div className="text-center py-16 animate-fade-in-up">
                <div className="w-24 h-24 mx-auto rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <p className="text-lg font-semibold text-green-400">All Clear</p>
                <p className="text-sm text-slate-500 mt-1">No high-risk transactions pending authorization.</p>
                <p className="text-xs text-slate-600 mt-3">Auto-refreshes every 10 seconds</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pending.map((t, idx) => (
                  <div key={t.transaction_id} className="bg-white/80 backdrop-blur border border-red-500/20 border-l-4 border-l-red-500 rounded-xl overflow-hidden animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                    {/* Summary row */}
                    <button
                      onClick={() => setSelected(selected === t.transaction_id ? null : t.transaction_id)}
                      className="w-full p-5 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <MiniGauge score={t.risk_score} level={t.risk_level} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">₹{parseFloat(t.amount).toLocaleString('en-IN')}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${RISK_COLORS[t.risk_level]}20`, color: RISK_COLORS[t.risk_level], border: `1px solid ${RISK_COLORS[t.risk_level]}40` }}>{t.risk_level}</span>
                          </div>
                          <p className="text-sm text-slate-400 mt-1 truncate">{t.sender_name} → <span className="font-mono text-slate-300">{t.receiver_upi}</span></p>
                        </div>
                        <svg className={`w-5 h-5 text-slate-500 transition-transform ${selected === t.transaction_id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {selected === t.transaction_id && (
                      <div className="px-5 pb-5 border-t border-gray-200/50 pt-4 space-y-4 animate-fade-in">
                        {/* Transaction info */}
                        <div className="glass rounded-lg p-4">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-3">Transaction Details</p>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: 'Transaction ID', value: t.transaction_id.slice(0, 12) + '...' },
                              { label: 'Sender', value: t.sender_name },
                              { label: 'Receiver UPI', value: t.receiver_upi },
                              { label: 'Amount', value: `₹${parseFloat(t.amount).toLocaleString('en-IN')}` },
                              { label: 'Date', value: t.created_at ? new Date(t.created_at).toLocaleString('en-IN') : '—' },
                              { label: 'Model', value: t.model_version || 'ml-v1' },
                            ].map(item => (
                              <div key={item.label}>
                                <p className="text-[10px] text-slate-600 uppercase tracking-wide">{item.label}</p>
                                <p className="text-sm text-slate-300 font-mono mt-0.5">{item.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* AI Risk Analysis */}
                        <div className="p-4 rounded-lg bg-red-500/5 border-l-4 border-l-red-500 border border-red-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" /></svg>
                            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">AI Risk Analysis — UPI Random Forest</span>
                          </div>
                          <div className="flex items-center gap-4 mb-4">
                            <MiniGauge score={t.risk_score} level={t.risk_level} size={56} />
                            <div className="flex-1">
                              <div className="h-3 bg-gray-50 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${t.risk_score}%`, backgroundColor: RISK_COLORS[t.risk_level] }} />
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1">Score: {t.risk_score}% — Level: {t.risk_level}</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold mb-2">Detection Reasons</p>
                          <ul className="space-y-1.5">
                            {(t.reasons || []).map((r, i) => (
                              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />{r}
                              </li>
                            ))}
                          </ul>
                          {t.hive_signals?.length > 0 && (
                            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/15">
                              <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1.5">H.I.V.E. Intelligence</p>
                              {t.hive_signals.map((s, i) => (
                                <div key={i} className="text-xs text-red-300 flex items-center gap-2 mb-1">
                                  <span className="font-mono bg-red-500/20 px-2 py-0.5 rounded">{s.entity_value}</span>
                                  <span className="text-slate-500">—</span>
                                  <span>{s.scam_type}</span>
                                  <span className="text-red-400 font-bold text-[10px]">({s.severity})</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Scammer Intelligence */}
                        {t.intelligence && (
                          <div className="p-4 rounded-lg bg-indigo-500/5 border-l-4 border-l-indigo-500 border border-indigo-500/20">
                            <div className="flex items-center gap-2 mb-3">
                              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Scammer Intelligence Profile</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {t.intelligence.scammer_alias && (
                                <div><p className="text-[9px] text-slate-600 uppercase tracking-wide">Alias</p><p className="text-sm text-slate-200 font-medium">{t.intelligence.scammer_alias}</p></div>
                              )}
                              {t.intelligence.impersonated_org && (
                                <div><p className="text-[9px] text-slate-600 uppercase tracking-wide">Impersonating</p><p className="text-sm text-red-300 font-medium">{t.intelligence.impersonated_org}</p></div>
                              )}
                              {t.intelligence.threat_type && (
                                <div><p className="text-[9px] text-slate-600 uppercase tracking-wide">Threat Type</p><p className="text-sm text-amber-300">{t.intelligence.threat_type.replace(/_/g, ' ')}</p></div>
                              )}
                              {t.intelligence.urgency_deadline && (
                                <div><p className="text-[9px] text-slate-600 uppercase tracking-wide">Deadline</p><p className="text-sm text-red-400 font-medium">{t.intelligence.urgency_deadline}</p></div>
                              )}
                              {t.intelligence.promised_returns && (
                                <div><p className="text-[9px] text-slate-600 uppercase tracking-wide">Promised Returns</p><p className="text-sm text-amber-300">{t.intelligence.promised_returns}</p></div>
                              )}
                              {t.intelligence.target_victim_profile && (
                                <div><p className="text-[9px] text-slate-600 uppercase tracking-wide">Target Profile</p><p className="text-sm text-slate-300">{t.intelligence.target_victim_profile.replace(/_/g, ' ')}</p></div>
                              )}
                            </div>
                            {t.intelligence.tactics?.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-1.5">Tactics Used</p>
                                <div className="flex flex-wrap gap-1.5">{t.intelligence.tactics.map((tac, i) => (
                                  <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">{tac}</span>
                                ))}</div>
                              </div>
                            )}
                            {t.intelligence.account_numbers?.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[9px] text-slate-600 uppercase tracking-wide">Linked Accounts</p>
                                {t.intelligence.account_numbers.map((a, i) => <p key={i} className="text-xs text-slate-300 font-mono mt-0.5">{a}</p>)}
                              </div>
                            )}
                            {t.intelligence.message_snippet && (
                              <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                                <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-1">Original Scam Message</p>
                                <p className="text-xs text-slate-400 italic leading-relaxed">"{t.intelligence.message_snippet}"</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Status */}
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center flex items-center justify-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          <p className="text-sm font-bold text-amber-400 uppercase tracking-wider">Awaiting Authorization</p>
                        </div>

                        {/* Reject reason */}
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Reason (optional for reject)"
                          className="w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                        />

                        {/* Action buttons */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleAction(t.transaction_id, 'approve')}
                            disabled={acting}
                            className="flex-1 py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-all disabled:opacity-50 hover:shadow-[0_0_24px_rgba(34,197,94,0.25)] flex items-center justify-center gap-2"
                          >
                            {acting ? (
                              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                            ) : (
                              <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> APPROVE TRANSACTION</>
                            )}
                          </button>
                          <button
                            onClick={() => handleAction(t.transaction_id, 'reject')}
                            disabled={acting}
                            className="flex-1 py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-all disabled:opacity-50 hover:shadow-[0_0_24px_rgba(239,68,68,0.25)] flex items-center justify-center gap-2"
                          >
                            {acting ? (
                              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                            ) : (
                              <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> REJECT TRANSACTION</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
