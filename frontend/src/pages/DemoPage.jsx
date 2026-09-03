import { useState, useEffect } from 'react'

const RISK_COLORS = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#dc2626' }
const STEP_ICONS = {
  start: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', path: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  incoming: { bg: 'bg-amber-500/20', text: 'text-amber-400', path: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
  danger: { bg: 'bg-red-500/20', text: 'text-red-400', path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' },
  notify: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', path: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  signal: { bg: 'bg-orange-500/20', text: 'text-orange-400', path: 'M13 10V3L4 14h7v7l9-11h-7z' },
  payment: { bg: 'bg-purple-500/20', text: 'text-purple-400', path: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  safe: { bg: 'bg-green-500/20', text: 'text-green-400', path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  critical: { bg: 'bg-red-600/20', text: 'text-red-300', path: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  warning: { bg: 'bg-amber-500/20', text: 'text-amber-300', path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' },
  hold: { bg: 'bg-red-600/20', text: 'text-red-300', path: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
  verify: { bg: 'bg-amber-500/20', text: 'text-amber-400', path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  allow: { bg: 'bg-green-500/20', text: 'text-green-400', path: 'M5 13l4 4L19 7' },
  info: { bg: 'bg-slate-500/20', text: 'text-slate-400', path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  blocked: { bg: 'bg-red-600/20', text: 'text-red-300', path: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  success: { bg: 'bg-green-500/20', text: 'text-green-400', path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  pending: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  error: { bg: 'bg-red-500/20', text: 'text-red-400', path: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  velocity: { bg: 'bg-orange-500/20', text: 'text-orange-400', path: 'M13 10V3L4 14h7v7l9-11h-7z' },
}

const SCENARIO_META = {
  normal_payment: { color: 'border-green-500/40 hover:border-green-500/70', badge: 'bg-green-500/20 text-green-300', icon: 'safe' },
  hive_scam_then_payment: { color: 'border-red-500/40 hover:border-red-500/70', badge: 'bg-red-500/20 text-red-300', icon: 'danger' },
  account_takeover: { color: 'border-red-600/40 hover:border-red-600/70', badge: 'bg-red-600/20 text-red-200', icon: 'critical' },
  new_ben_unusual: { color: 'border-amber-500/40 hover:border-amber-500/70', badge: 'bg-amber-500/20 text-amber-300', icon: 'warning' },
  high_risk_network: { color: 'border-orange-500/40 hover:border-orange-500/70', badge: 'bg-orange-500/20 text-orange-300', icon: 'signal' },
}

function RiskBar({ label, value, max = 100 }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = pct >= 80 ? '#dc2626' : pct >= 60 ? '#ef4444' : pct >= 40 ? '#f59e0b' : '#22c55e'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span className="text-slate-500">{label}</span><span className="text-slate-400 font-mono">{Math.round(value)}</span></div>
      <div className="h-2 bg-[#0f172a] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: color }} /></div>
    </div>
  )
}

export default function DemoPage() {
  const [scenarios, setScenarios] = useState({})
  const [running, setRunning] = useState(null)
  const [result, setResult] = useState(null)
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    fetch('/api/demo/scenarios').then(r => r.json()).then(setScenarios).catch(() => {})
    fetch('/api/demo/metrics').then(r => r.json()).then(setMetrics).catch(() => {})
  }, [])

  async function runScenario(key) {
    setRunning(key)
    setResult(null)
    setVisibleSteps(0)
    try {
      const resp = await fetch(`/api/demo/run/${key}`, { method: 'POST' })
      const data = await resp.json()
      setResult(data)
      if (data.timeline) {
        for (let i = 0; i <= data.timeline.length; i++) {
          setTimeout(() => setVisibleSteps(i), i * 400)
        }
      }
      fetch('/api/demo/metrics').then(r => r.json()).then(setMetrics).catch(() => {})
    } catch (e) { setResult({ success: false, error: e.message }) }
    finally { setRunning(null) }
  }

  const risk = result?.risk_evaluation
  const features = risk?.features_used || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Financial Guardian — Demo Mode</h1>
            <p className="text-indigo-100 text-sm">End-to-end attack-to-protection demonstration</p>
          </div>
        </div>
        <p className="text-xs text-indigo-200 mt-3 bg-white/10 inline-block px-3 py-1 rounded-full">ALL VALUES ARE SIMULATED — No real financial transactions</p>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Scams Detected', value: metrics.scams_detected, color: 'text-red-400' },
            { label: 'Users Alerted', value: metrics.users_alerted, color: 'text-amber-400' },
            { label: 'Risk Evaluations', value: metrics.risk_evaluations, color: 'text-indigo-400' },
            { label: 'Txns Prevented', value: metrics.transactions_prevented, color: 'text-red-300' },
            { label: 'Loss Prevented (Sim)', value: `Rs${metrics.simulated_loss_prevented?.toLocaleString('en-IN') || 0}`, color: 'text-green-400' },
          ].map((m, i) => (
            <div key={i} className="bg-[#1e293b] border border-[#334155] rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{m.label}</p>
              <p className={`text-xl font-bold mt-1 ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Scenario Selector */}
      <div>
        <h2 className="font-semibold text-slate-200 mb-3">Select a Demo Scenario</h2>
        <div className="grid md:grid-cols-5 gap-3">
          {Object.entries(scenarios).map(([key, s]) => {
            const meta = SCENARIO_META[key] || SCENARIO_META.normal_payment
            const iconDef = STEP_ICONS[meta.icon] || STEP_ICONS.info
            return (
              <button key={key} onClick={() => runScenario(key)} disabled={running !== null}
                className={`bg-[#1e293b] border ${meta.color} rounded-xl p-4 text-left transition-all disabled:opacity-40 group`}>
                <div className={`w-10 h-10 rounded-lg ${iconDef.bg} flex items-center justify-center mb-3`}>
                  <svg className={`w-5 h-5 ${iconDef.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={iconDef.path} /></svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-200 leading-snug">{s.title}</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{s.description}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${meta.badge}`}>{s.expected}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Running indicator */}
      {running && !result && (
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200">Running scenario...</h3>
          <p className="text-sm text-slate-500 mt-1">Executing full H.I.V.E. + Model 2 pipeline</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Timeline */}
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-200">Investigation Timeline</h3>
              <span className="text-xs text-slate-500">Total: {result.elapsed_ms}ms</span>
            </div>
            <div className="space-y-0">
              {result.timeline?.slice(0, visibleSteps).map((step, idx) => {
                const iconDef = STEP_ICONS[step.type] || STEP_ICONS.info
                const isLast = idx === (result.timeline?.length || 0) - 1
                return (
                  <div key={idx} className="flex gap-3 animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex flex-col items-center w-9 flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full ${iconDef.bg} flex items-center justify-center`}>
                        <svg className={`w-4 h-4 ${iconDef.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={iconDef.path} /></svg>
                      </div>
                      {!isLast && <div className="w-0.5 h-6 bg-[#334155]" />}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-semibold ${iconDef.text}`}>{step.title}</span>
                        <span className="text-[10px] text-slate-600 font-mono">{step.elapsed_ms}ms</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{step.details}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Risk Result */}
          {risk && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className={`border rounded-xl p-5 ${risk.risk_level === 'LOW' ? 'bg-green-500/5 border-green-500/30' : risk.risk_level === 'CRITICAL' ? 'bg-red-600/10 border-red-600/30' : risk.risk_level === 'HIGH' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-4xl font-bold" style={{ color: RISK_COLORS[risk.risk_level] }}>{risk.risk_score}</p>
                    <p className="text-[10px] text-slate-500">RISK SCORE</p>
                  </div>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${risk.risk_level === 'LOW' ? 'bg-green-500/20 text-green-300' : risk.risk_level === 'CRITICAL' ? 'bg-red-600/30 text-red-200' : risk.risk_level === 'HIGH' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>{risk.risk_level}</span>
                    <p className="text-sm text-slate-400 mt-1">Decision: <span className="font-bold text-slate-200">{risk.decision}</span></p>
                    <p className="text-xs text-slate-500">Model: {risk.model_version}</p>
                  </div>
                </div>
                {risk.risk_velocity?.velocity_score > 0 && (
                  <div className="p-2 rounded bg-[#0f172a]/50 text-xs flex items-center gap-2 mb-3">
                    <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <span className="text-slate-400">Velocity: {risk.risk_velocity.trend?.replace(/_/g, ' ')} ({risk.risk_velocity.signal_count} signals)</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  {risk.reasons?.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5" style={{ color: RISK_COLORS[risk.risk_level] }}>&#8226;</span>
                      <span className="text-slate-400">{r}</span>
                    </div>
                  ))}
                </div>
                {risk.hive_signals_used?.length > 0 && (
                  <div className="mt-3 p-2 rounded bg-red-500/5 border border-red-500/20 text-[11px] text-red-400">
                    H.I.V.E.: {risk.hive_signals_used.map(s => `${s.entity_value} (${s.severity})`).join(', ')}
                  </div>
                )}
              </div>

              <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
                <h4 className="font-semibold text-slate-200 mb-3 text-sm">Risk Breakdown</h4>
                <div className="space-y-2.5">
                  <RiskBar label="Transaction Amount" value={Math.min((features.amount_to_avg_ratio || 0) * 10, 100)} />
                  <RiskBar label="Beneficiary Risk" value={features.is_new_beneficiary ? 80 : features.beneficiary_verified ? 10 : 50} />
                  <RiskBar label="Behavior Anomaly" value={Math.min(Math.max(((features.amount_to_max_ratio || 0) - 1) * 30, 0), 100)} />
                  <RiskBar label="H.I.V.E. Intelligence" value={features.hive_recipient_flagged ? (features.hive_signal_severity || 1) * 25 : 0} />
                  <RiskBar label="Device Trust" value={features.is_new_device ? 70 : features.device_trusted ? 5 : 40} />
                  <RiskBar label="Account Events" value={Math.min((features.account_events_48h || 0) * 25, 100)} />
                </div>
              </div>
            </div>
          )}

          {/* H.I.V.E. Result */}
          {result.hive_result && (
            <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
              <h4 className="font-semibold text-slate-200 mb-3">H.I.V.E. Model 1 Detection</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
                <div><p className="text-[10px] text-slate-500">Scam</p><p className={`font-bold ${result.hive_result.is_scam ? 'text-red-400' : 'text-green-400'}`}>{result.hive_result.is_scam ? 'DETECTED' : 'CLEAN'}</p></div>
                <div><p className="text-[10px] text-slate-500">Confidence</p><p className="font-bold text-slate-200">{(result.hive_result.confidence * 100).toFixed(0)}%</p></div>
                <div><p className="text-[10px] text-slate-500">Type</p><p className="font-bold text-slate-200">{result.hive_result.scam_type || 'N/A'}</p></div>
                <div><p className="text-[10px] text-slate-500">Notification</p><p className="font-bold text-cyan-400">{result.hive_result.notification?.severity || 'sent'}</p></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
