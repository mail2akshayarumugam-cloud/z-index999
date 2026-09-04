import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const RISK_COLORS = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#dc2626',
}

function CircularGauge({ score, level, size = 120 }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(Math.max(score / 100, 0), 1)
  const offset = circumference * (1 - pct)
  const color = RISK_COLORS[level] || '#6366f1'
  return (
    <div className="relative animate-scale-up" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold tabular-nums" style={{ color }}>{score}</p>
        <p className="text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">RISK</p>
      </div>
    </div>
  )
}

function RiskBar({ label, value, max = 100 }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100)
  const color =
    pct >= 80 ? '#dc2626' : pct >= 60 ? '#ef4444' : pct >= 40 ? '#f59e0b' : '#22c55e'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-800 font-mono tabular-nums">{Math.round(value)}%</span>
      </div>
      <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { preview, userId } = location.state || {}
  const [phase, setPhase] = useState('analyzing')
  const [commitResult, setCommitResult] = useState(null)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [pin, setPin] = useState(['', '', '', ''])
  const [pinError, setPinError] = useState('')
  const [pendingOverride, setPendingOverride] = useState(null)
  const [showSecurityQ, setShowSecurityQ] = useState(false)
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [securityError, setSecurityError] = useState('')
  const [securityVerified, setSecurityVerified] = useState(false)

  useEffect(() => {
    if (!preview) {
      navigate('/pay')
      return
    }
    const timer = setTimeout(() => setPhase('result'), 1800)
    return () => clearTimeout(timer)
  }, [preview, navigate])

  useEffect(() => {
    if (phase === 'result' && decision === 'HOLD' && preview?.transaction_id && !committing) {
      fetch('/api/transactions/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: preview.transaction_id, user_id: userId }),
      }).catch(() => {})
    }
  }, [phase])

  if (!preview) return null

  const risk = preview.risk_evaluation
  const level = risk.risk_level
  const decision = risk.decision
  const features = risk.features_used || {}

  function handlePinChange(idx, val) {
    if (val.length > 1) return
    if (val && !/^\d$/.test(val)) return
    const next = [...pin]
    next[idx] = val
    setPin(next)
    setPinError('')
    if (val && idx < 3) {
      const el = document.getElementById(`pin-${idx + 1}`)
      if (el) el.focus()
    }
  }

  function handlePinKeyDown(idx, e) {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      const el = document.getElementById(`pin-${idx - 1}`)
      if (el) el.focus()
    }
  }

  function requestPin(overrideReason) {
    setPendingOverride(overrideReason)
    const needsSecurityQ = decision === 'VERIFY' || decision === 'STRONG_VERIFY'
    if (needsSecurityQ && !securityVerified) {
      setSecurityAnswer('')
      setSecurityError('')
      fetch(`/api/auth/security-question/${userId}`)
        .then(r => r.json())
        .then(d => { setSecurityQuestion(d.question); setShowSecurityQ(true) })
        .catch(() => { goToPin() })
      return
    }
    goToPin()
  }

  function goToPin() {
    setShowSecurityQ(false)
    setPin(['', '', '', ''])
    setPinError('')
    setShowPin(true)
    setTimeout(() => {
      const el = document.getElementById('pin-0')
      if (el) el.focus()
    }, 100)
  }

  async function submitSecurityAnswer() {
    if (!securityAnswer.trim()) { setSecurityError('Please enter your answer'); return }
    setCommitting(true)
    setSecurityError('')
    try {
      const resp = await fetch('/api/auth/verify-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, answer: securityAnswer }),
      })
      if (!resp.ok) {
        const d = await resp.json()
        setSecurityError(d.detail || 'Incorrect answer')
        setSecurityAnswer('')
        setCommitting(false)
        return
      }
      setSecurityVerified(true)
      goToPin()
    } catch (err) {
      setSecurityError(err.message)
    } finally {
      setCommitting(false)
    }
  }

  async function submitPin() {
    const pinStr = pin.join('')
    if (pinStr.length !== 4) { setPinError('Enter 4-digit PIN'); return }
    setCommitting(true)
    setPinError('')
    setError('')
    try {
      const pinResp = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, pin: pinStr }),
      })
      if (!pinResp.ok) {
        const d = await pinResp.json()
        setPinError(d.detail || 'Invalid PIN')
        setPin(['', '', '', ''])
        setTimeout(() => { const el = document.getElementById('pin-0'); if (el) el.focus() }, 50)
        setCommitting(false)
        return
      }
      const resp = await fetch('/api/transactions/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: preview.transaction_id,
          user_id: userId,
          override_reason: pendingOverride || undefined,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Failed')
      setCommitResult(data)
      setShowPin(false)
      setPhase('complete')
    } catch (err) {
      setError(err.message)
      setShowPin(false)
    } finally {
      setCommitting(false)
    }
  }

  /* ── COMPLETE / RECEIPT ── */
  if (phase === 'complete' && commitResult) {
    const success = commitResult.status === 'committed'
    const txnRef = `UPI/${preview.transaction_id.slice(0, 12).toUpperCase()}`
    const txnTime = commitResult.committed_at
      ? new Date(commitResult.committed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return (
      <div className="min-h-screen bg-[#f0f2f5] bg-grid flex items-center justify-center p-4">
        <div className="max-w-md w-full animate-fade-in-up">
          <div className={`rounded-2xl border p-6 text-center ${success ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 animate-scale-up ${success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {success ? (
                <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                     style={{ animation: 'drawCheck 0.6s ease-out 0.3s both' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900">{success ? 'Payment Successful' : 'Payment Blocked'}</h1>
            <p className="text-3xl font-bold text-slate-900 mt-3 font-mono tabular-nums">₹{parseFloat(preview.amount).toLocaleString('en-IN')}</p>

            <div className="mt-6 space-y-0 text-left">
              {[
                { label: 'To', value: preview.beneficiary_upi, mono: true },
                preview.resolved_from_phone && { label: 'Mobile', value: preview.resolved_from_phone, mono: true },
                preview.beneficiary_name && { label: 'Name', value: preview.beneficiary_name },
                { label: 'UPI Ref No.', value: txnRef, mono: true },
                { label: 'Date & Time', value: txnTime },
                { label: 'Status', value: success ? 'SUCCESS' : 'BLOCKED', color: success ? 'text-green-600' : 'text-red-600' },
                success && commitResult.balance_remaining && { label: 'Balance', value: `₹${parseFloat(commitResult.balance_remaining).toLocaleString('en-IN')}` },
              ].filter(Boolean).map((item, i) => (
                <div key={i} className="flex justify-between py-2.5 border-b border-dashed border-gray-200/60 last:border-0">
                  <span className="text-xs text-slate-600">{item.label}</span>
                  <span className={`text-sm ${item.color || 'text-slate-700'} ${item.mono ? 'font-mono' : ''} ${item.color ? 'font-bold' : ''}`}>{item.value}</span>
                </div>
              ))}
              <div className="flex justify-between py-2.5">
                <span className="text-xs text-slate-600">Risk Check</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  risk.risk_level === 'LOW' ? 'bg-green-500/20 text-green-600' :
                  risk.risk_level === 'MEDIUM' ? 'bg-amber-500/20 text-amber-700' :
                  'bg-red-500/20 text-red-600'
                }`}>{risk.risk_level} — {risk.decision}</span>
              </div>
            </div>

            {!success && commitResult.message && (
              <p className="text-sm text-red-600 mt-4">{commitResult.message}</p>
            )}
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full mt-4 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  /* ── MAIN REVIEW ── */
  return (
    <div className="min-h-screen bg-[#f0f2f5] bg-grid">
      {/* Header */}
      <div className="h-14 bg-gray-50/80 backdrop-blur-md border-b border-[#1e293b] flex items-center px-4 gap-3 flex-shrink-0 sticky top-0 z-10">
        <button
          onClick={() => navigate('/pay')}
          className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-slate-800">Security Review</span>
        <div className="flex-1" />
        <span className="text-[10px] bg-indigo-500/20 text-indigo-600 px-2 py-0.5 rounded-full font-medium">Model 2</span>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Transaction summary */}
        <div className="bg-white/80 backdrop-blur border border-gray-200 rounded-xl p-5 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">Paying</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                ₹{parseFloat(preview.amount).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="h-10 w-px bg-[#334155]" />
            <div className="text-right">
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">To</p>
              <p className="text-sm font-mono text-slate-700 mt-1">
                {preview.beneficiary_upi}
              </p>
              {preview.resolved_from_phone && (
                <p className="text-[10px] text-indigo-600 mt-0.5">
                  via mobile: {preview.resolved_from_phone}
                </p>
              )}
              <p className="text-[11px] mt-1">
                {preview.is_new_beneficiary ? (
                  <span className="text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full text-[10px] font-medium">New Beneficiary</span>
                ) : (
                  <span className="text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full text-[10px] font-medium">
                    {preview.beneficiary_name || 'Known Contact'}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Analyzing animation */}
        {phase === 'analyzing' && (
          <div className="bg-white/60 backdrop-blur border border-gray-200 rounded-xl p-10 text-center animate-fade-in-up">
            <div className="w-24 h-24 mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10 animate-pulse-glow" />
              <div className="absolute inset-2 rounded-full border-2 border-indigo-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '1s' }} />
              <div className="absolute inset-3 rounded-full border-2 border-t-cyan-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
              <svg className="absolute inset-5 w-14 h-14 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700">
              Verifying Transaction Security
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              Model 2 is evaluating 30 risk features
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {[
                'H.I.V.E. Intelligence',
                'Behavioral Profile',
                'Device Trust',
                'Network Graph',
                'Amount Pattern',
                'Account Events',
              ].map((s, i) => (
                <span
                  key={i}
                  className="text-[10px] px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {phase === 'result' && (
          <>
            {/* Risk card */}
            <div
              className={`rounded-xl p-5 border animate-fade-in-up ${
                level === 'CRITICAL' || level === 'HIGH' ? 'animate-risk-pulse' : ''
              } ${
                level === 'LOW'
                  ? 'bg-green-500/5 border-green-500/30'
                  : level === 'MEDIUM'
                  ? 'bg-amber-500/5 border-amber-500/30'
                  : level === 'HIGH'
                  ? 'bg-red-500/5 border-red-500/30'
                  : 'bg-red-600/10 border-red-600/40'
              }`}
            >
              <div className="flex items-center gap-5 mb-5">
                <CircularGauge score={risk.risk_score} level={level} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                        level === 'LOW'
                          ? 'bg-green-500/20 text-green-600'
                          : level === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-700'
                          : level === 'HIGH'
                          ? 'bg-red-500/20 text-red-600'
                          : 'bg-red-600/30 text-red-700'
                      }`}
                    >
                      {level}
                    </span>
                    <span className="text-xs text-slate-600">
                      Decision:{' '}
                      <strong className="text-slate-800">{decision}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    Model: <span className="text-slate-600 font-mono">{risk.model_version}</span>
                  </p>
                </div>
              </div>

              {/* Score bar */}
              <div className="mb-5">
                <div className="relative h-3 bg-gray-50/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${risk.risk_score}%`,
                      background: `linear-gradient(90deg, #22c55e, ${risk.risk_score > 40 ? '#f59e0b' : '#22c55e'} ${Math.min(40 / risk.risk_score * 100, 100)}%, ${risk.risk_score > 70 ? '#ef4444' : '#f59e0b'})`,
                    }}
                  />
                  {/* Tick marks */}
                  {[40, 70, 90].map(t => (
                    <div key={t} className="absolute top-0 bottom-0 w-px bg-slate-600/50" style={{ left: `${t}%` }} />
                  ))}
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-slate-600 font-mono">
                  <span>0</span>
                  <span style={{ position: 'absolute', left: '40%', transform: 'translateX(-50%)' }}>40</span>
                  <span style={{ position: 'absolute', left: '70%', transform: 'translateX(-50%)' }}>70</span>
                  <span style={{ position: 'absolute', left: '90%', transform: 'translateX(-50%)' }}>90</span>
                  <span>100</span>
                </div>
              </div>

              {/* Risk velocity */}
              {risk.risk_velocity?.velocity_score > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-gray-50/50 border border-orange-500/20 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm text-slate-800">
                    Risk Velocity:{' '}
                    <strong>{risk.risk_velocity.trend?.replace(/_/g, ' ')}</strong>
                  </span>
                  <span className="text-xs text-slate-600">
                    ({risk.risk_velocity.signal_count} signals accumulated)
                  </span>
                </div>
              )}

              {/* Reasons */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  Analysis
                </p>
                {risk.reasons?.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: RISK_COLORS[level] }} />
                    <span className="text-slate-800">{r}</span>
                  </div>
                ))}
              </div>

              {/* H.I.V.E. signals */}
              {risk.hive_signals_used?.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-red-500/5 border-l-4 border-l-red-500 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-xs font-bold text-red-600 uppercase tracking-wide">H.I.V.E. Intelligence (Model 1)</span>
                  </div>
                  {risk.hive_signals_used.map((s, i) => (
                    <div key={i} className="text-xs text-red-600 mb-1 flex items-center gap-2">
                      <span className="font-mono bg-red-500/10 px-2 py-0.5 rounded">{s.entity_value}</span>
                      <span className="text-slate-600">—</span>
                      <span>{s.scam_type}</span>
                      <span className="text-red-600 font-bold text-[10px] bg-red-500/20 px-1.5 py-0.5 rounded">
                        {s.severity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Feature breakdown */}
            <div className="bg-white/80 backdrop-blur border border-gray-200 rounded-xl p-5 animate-fade-in-up delay-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                Risk Feature Breakdown
              </h3>
              <div className="space-y-3.5">
                <RiskBar label="H.I.V.E. Intelligence" value={features.hive_recipient_flagged ? (features.hive_signal_severity || 1) * 25 : 0} />
                <RiskBar label="Beneficiary Trust" value={features.is_new_beneficiary ? 80 : features.beneficiary_verified ? 10 : 50} />
                <RiskBar label="Amount vs Average" value={Math.min((features.amount_to_avg_ratio || 0) * 10, 100)} />
                <RiskBar label="Amount vs Max" value={Math.min(Math.max(((features.amount_to_max_ratio || 0) - 1) * 30, 0), 100)} />
                <RiskBar label="Device Trust" value={features.is_new_device ? 70 : features.device_trusted ? 5 : 40} />
                <RiskBar label="Account Events (48h)" value={Math.min((features.account_events_48h || 0) * 25, 100)} />
                <RiskBar label="Transaction Velocity (24h)" value={Math.min((features.txn_frequency_24h || 0) * 15, 100)} />
                <RiskBar label="Network Risk" value={Math.min((features.recipient_suspicious_neighbor_count || 0) * 30, 100)} />
              </div>
            </div>

            {/* Action */}
            <div className="bg-white/80 backdrop-blur border border-gray-200 rounded-xl p-5 animate-fade-in-up delay-300">
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* Security Question */}
              {showSecurityQ && !showPin && (
                <div className="mb-4 p-5 rounded-xl glass-strong animate-scale-up">
                  <div className="text-center mb-4">
                    <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
                      <svg className="w-7 h-7 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Security Verification</p>
                    <p className="text-xs text-slate-600 mt-1">{securityQuestion}</p>
                  </div>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={e => { setSecurityAnswer(e.target.value); setSecurityError('') }}
                    onKeyDown={e => { if (e.key === 'Enter') submitSecurityAnswer() }}
                    placeholder="Your answer..."
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-slate-700 placeholder-slate-600 text-center focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                  />
                  {securityError && <p className="text-center text-sm text-red-600 mt-2">{securityError}</p>}
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setShowSecurityQ(false); setSecurityAnswer(''); setSecurityError('') }}
                      className="flex-1 py-3 rounded-xl border border-gray-200 text-slate-600 hover:bg-[#334155] transition-colors text-sm">Cancel</button>
                    <button onClick={submitSecurityAnswer} disabled={committing || !securityAnswer.trim()}
                      className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                      {committing ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</> : 'Verify'}
                    </button>
                  </div>
                </div>
              )}

              {/* PIN Entry */}
              {showPin && (
                <div className="mb-4 p-6 rounded-xl glass-strong animate-scale-up">
                  <div className="text-center mb-5">
                    <div className="w-14 h-14 mx-auto rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-3">
                      <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Enter UPI PIN</p>
                    <p className="text-[11px] text-slate-600 mt-1">4-digit PIN to authorize payment</p>
                  </div>
                  <div className="flex justify-center gap-4 mb-5">
                    {[0, 1, 2, 3].map(i => (
                      <input
                        key={i}
                        id={`pin-${i}`}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={pin[i]}
                        onChange={e => handlePinChange(i, e.target.value)}
                        onKeyDown={e => handlePinKeyDown(i, e)}
                        className="w-14 h-16 text-center text-2xl font-bold rounded-xl bg-gray-50 border-2 border-gray-200 text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                      />
                    ))}
                  </div>
                  {pinError && (
                    <p className="text-center text-sm text-red-600 mb-3">{pinError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowPin(false); setPin(['','','','']); setPinError('') }}
                      className="flex-1 py-3 rounded-xl border border-gray-200 text-slate-600 hover:bg-[#334155] transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitPin}
                      disabled={committing || pin.join('').length !== 4}
                      className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                    >
                      {committing ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Paying...</>
                      ) : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}

              {decision === 'ALLOW' && !showPin && (
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>
                    <span className="text-green-600 text-sm font-medium">Payment passed all security checks</span>
                  </div>
                  <button
                    onClick={() => requestPin()}
                    disabled={committing}
                    className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-lg transition-all disabled:opacity-50 hover:shadow-[0_0_24px_rgba(34,197,94,0.2)]"
                  >
                    Enter UPI PIN to Pay
                  </button>
                </div>
              )}

              {decision === 'VERIFY' && !showPin && !showSecurityQ && (
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
                    <svg className="w-4 h-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" /></svg>
                    <span className="text-amber-700 text-sm font-medium">Additional verification required</span>
                  </div>
                  <button
                    onClick={() => requestPin('User verified via OTP')}
                    disabled={committing}
                    className="w-full py-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-all disabled:opacity-50 hover:shadow-[0_0_24px_rgba(245,158,11,0.2)]"
                  >
                    Verify & Enter PIN
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="w-full py-3 rounded-xl border border-gray-200 text-slate-600 hover:bg-[#334155] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {decision === 'STRONG_VERIFY' && !showPin && !showSecurityQ && (
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20">
                    <svg className="w-4 h-4 text-red-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    <span className="text-red-600 text-sm font-medium">High risk detected — strong verification required</span>
                  </div>
                  <button
                    onClick={() => requestPin('Verified recipient independently')}
                    disabled={committing}
                    className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-all disabled:opacity-50 hover:shadow-[0_0_24px_rgba(239,68,68,0.2)]"
                  >
                    I Verify — Enter PIN
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="w-full py-3 rounded-xl border border-red-500/30 text-red-600 hover:bg-red-500/10 transition-colors"
                  >
                    Cancel Payment
                  </button>
                </div>
              )}

              {decision === 'HOLD' && (
                <div className="text-center space-y-4 animate-fade-in-up">
                  <div className="p-5 rounded-xl bg-amber-600/5 border-2 border-amber-500/30 animate-risk-pulse" style={{ '--ring-color': '#f59e0b' }}>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-700 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      </div>
                      <p className="text-amber-700 font-bold text-lg">
                        Transaction On Hold
                      </p>
                    </div>
                    <p className="text-sm text-amber-700/90 mt-2">
                      Critical risk detected by Model 2. This transaction has been
                      escalated to a higher authority (CFO) for review.
                    </p>
                    <p className="text-xs text-slate-600 mt-3">
                      The authority has been notified and will approve or reject this transaction.
                    </p>
                  </div>
                  <div className="py-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 font-semibold flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                    Awaiting Authority Approval
                  </div>
                  <button
                    onClick={() => navigate('/')}
                    className="w-full py-3 rounded-xl border border-gray-200 text-slate-600 hover:bg-[#334155] transition-colors"
                  >
                    Return Home
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
