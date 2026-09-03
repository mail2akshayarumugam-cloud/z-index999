import { useState } from 'react'

const DEMO_TIMELINE = [
  { time: '09:00', title: 'Scam message received by Neha', desc: 'WhatsApp from +919900088877 (Vikram) claiming to be HDFC Bank Premium Investment Desk offering 15% monthly returns', type: 'alert', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
  { time: '09:01', title: 'H.I.V.E. Model 1 activated', desc: 'Message through preprocessing: normalization, entity extraction (UPI: vikram.invest@ybl, URL: hdfc-invest-returns.tk, phone: 9900088877)', type: 'process', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { time: '09:02', title: 'Scam detected — Investment Scam', desc: 'Confidence: 93%. Detected: unrealistic returns (15% monthly), urgency ("offer closes tonight"), bank impersonation, phishing URL', type: 'danger', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' },
  { time: '09:02', title: 'Neha notified', desc: 'Alert: "Investment scam detected. No legitimate bank offers 15% monthly returns. Do NOT send money to vikram.invest@ybl."', type: 'notify', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { time: '09:02', title: 'Bank risk signal created', desc: 'vikram.invest@ybl flagged as investment_scam (severity: high). Signal sent to Model 2 with 72h expiry.', type: 'signal', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { time: '09:05', title: 'Neha initiates payment', desc: 'Despite warning, Neha attempts Rs 25,000 payment to vikram.invest@ybl ("HDFC Premium FD Scheme")', type: 'warning', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { time: '09:06', title: 'Model 2 risk evaluation', desc: 'Score: 99+/100 (CRITICAL). H.I.V.E. flagged UPI + new beneficiary + Rs 25,000 is 9.6x her avg (Rs 2,600) + exceeds her max (Rs 12,000)', type: 'process', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { time: '09:06', title: 'Risk velocity: rapid accumulation', desc: 'H.I.V.E. alert + new beneficiary + amount anomaly = 3+ risk signals converging', type: 'danger', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { time: '09:06', title: 'Payment HELD — Rs 25,000 protected', desc: 'Decision: HOLD. Transaction blocked before completion. Neha\'s funds are safe.', type: 'success', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
]

const TYPE_STYLES = {
  alert: { dot: 'bg-amber-500', line: 'border-amber-500/30', icon_bg: 'bg-amber-500/20', icon_color: 'text-amber-400' },
  process: { dot: 'bg-indigo-500', line: 'border-indigo-500/30', icon_bg: 'bg-indigo-500/20', icon_color: 'text-indigo-400' },
  danger: { dot: 'bg-red-500', line: 'border-red-500/30', icon_bg: 'bg-red-500/20', icon_color: 'text-red-400' },
  notify: { dot: 'bg-cyan-500', line: 'border-cyan-500/30', icon_bg: 'bg-cyan-500/20', icon_color: 'text-cyan-400' },
  signal: { dot: 'bg-orange-500', line: 'border-orange-500/30', icon_bg: 'bg-orange-500/20', icon_color: 'text-orange-400' },
  warning: { dot: 'bg-amber-400', line: 'border-amber-400/30', icon_bg: 'bg-amber-400/20', icon_color: 'text-amber-300' },
  payment: { dot: 'bg-purple-500', line: 'border-purple-500/30', icon_bg: 'bg-purple-500/20', icon_color: 'text-purple-400' },
  success: { dot: 'bg-green-500', line: 'border-green-500/30', icon_bg: 'bg-green-500/20', icon_color: 'text-green-400' },
}

export default function TimelinePage() {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Security Timeline</h1>
        <span className="text-xs text-slate-500">Attack-to-Protection Demo Flow</span>
      </div>

      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6">
        <div className="relative">
          {DEMO_TIMELINE.map((event, idx) => {
            const style = TYPE_STYLES[event.type] || TYPE_STYLES.process
            const isLast = idx === DEMO_TIMELINE.length - 1
            return (
              <div key={idx} className="flex gap-4 group" onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}>
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center w-12 flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full ${style.icon_bg} flex items-center justify-center transition-transform ${hoveredIdx === idx ? 'scale-110' : ''}`}>
                    <svg className={`w-5 h-5 ${style.icon_color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={event.icon} />
                    </svg>
                  </div>
                  {!isLast && <div className={`w-0.5 flex-1 min-h-8 ${style.dot} opacity-30`} />}
                </div>

                {/* Content */}
                <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-mono text-slate-500 font-bold">{event.time}</span>
                    <h3 className={`font-semibold text-sm ${style.icon_color}`}>{event.title}</h3>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{event.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 text-center">
        <svg className="w-12 h-12 mx-auto text-green-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        <h3 className="text-lg font-bold text-green-400">Funds Protected</h3>
        <p className="text-sm text-green-300/70 mt-1">The two-model architecture detected the scam in the message and prevented the fraudulent payment — all within 8 seconds.</p>
      </div>
    </div>
  )
}
