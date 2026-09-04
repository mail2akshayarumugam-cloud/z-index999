import { useNavigate } from 'react-router-dom'

const RF_MATRIX = {
  title: 'Random Forest (Model 2)',
  subtitle: 'UPI Transaction Risk Classification',
  labels: ['Legitimate', 'Suspicious', 'Fraudulent'],
  matrix: [
    [942, 31, 7],
    [18, 187, 12],
    [3, 9, 141],
  ],
  metrics: { accuracy: 94.1, precision: 92.8, recall: 91.5, f1: 92.1 },
  color: '#6366f1',
}

const XGB_MATRIX = {
  title: 'XGBoost (Comparison)',
  subtitle: 'UPI Transaction Risk Classification',
  labels: ['Legitimate', 'Suspicious', 'Fraudulent'],
  matrix: [
    [951, 22, 7],
    [14, 192, 11],
    [2, 6, 145],
  ],
  metrics: { accuracy: 95.4, precision: 94.1, recall: 93.2, f1: 93.6 },
  color: '#10b981',
}

function ConfusionMatrix({ data }) {
  const { title, subtitle, labels, matrix, metrics, color } = data
  const maxVal = Math.max(...matrix.flat())

  return (
    <div className="bg-[#1e293b] rounded-2xl p-6 border border-[#334155]">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {Object.entries(metrics).map(([key, val]) => (
          <div key={key} className="text-center p-2.5 rounded-xl" style={{ backgroundColor: color + '10' }}>
            <p className="text-xl font-bold font-mono tabular-nums" style={{ color }}>{val}%</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">{key}</p>
          </div>
        ))}
      </div>

      {/* Matrix */}
      <div className="relative">
        {/* Y-axis label */}
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 -rotate-90">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest whitespace-nowrap">Actual</p>
        </div>

        <div className="ml-6">
          {/* X-axis label */}
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest text-center mb-2">Predicted</p>

          {/* Column headers */}
          <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: `80px repeat(${labels.length}, 1fr)` }}>
            <div />
            {labels.map(l => (
              <div key={l} className="text-center">
                <p className="text-[10px] text-slate-400 font-semibold truncate">{l}</p>
              </div>
            ))}
          </div>

          {/* Rows */}
          {matrix.map((row, i) => (
            <div key={i} className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: `80px repeat(${labels.length}, 1fr)` }}>
              <div className="flex items-center justify-end pr-2">
                <p className="text-[10px] text-slate-400 font-semibold truncate">{labels[i]}</p>
              </div>
              {row.map((val, j) => {
                const isDiagonal = i === j
                const intensity = val / maxVal
                const bg = isDiagonal
                  ? `rgba(${color === '#6366f1' ? '99,102,241' : '16,185,129'}, ${0.15 + intensity * 0.45})`
                  : `rgba(239,68,68, ${intensity * 0.3})`
                const textColor = isDiagonal ? color : (val > maxVal * 0.1 ? '#f87171' : '#64748b')

                return (
                  <div
                    key={j}
                    className="aspect-square flex items-center justify-center rounded-lg border transition-all hover:scale-105 cursor-default"
                    style={{
                      backgroundColor: bg,
                      borderColor: isDiagonal ? color + '30' : (val > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(51,65,85,0.3)'),
                    }}
                  >
                    <span className="text-lg font-bold font-mono tabular-nums" style={{ color: textColor }}>
                      {val}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-[#334155]">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: color + '40' }} />
          <span className="text-[10px] text-slate-500">Correct (diagonal)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500/20" />
          <span className="text-[10px] text-slate-500">Misclassified</span>
        </div>
      </div>
    </div>
  )
}

export default function ModelPerformance() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0b1120] bg-grid">
      <div className="h-14 glass flex items-center px-5 gap-3 animate-fade-in-down">
        <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center transition-all">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>
        <span className="text-sm font-semibold text-slate-200">Model Performance — Confusion Matrices</span>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">ML Model Comparison</h1>
          <p className="text-sm text-slate-500 mt-1">Confusion matrices for Random Forest (deployed) vs XGBoost on the UPI fraud detection dataset</p>
        </div>

        {/* Side by side matrices */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <ConfusionMatrix data={RF_MATRIX} />
          <ConfusionMatrix data={XGB_MATRIX} />
        </div>

        {/* Comparison table */}
        <div className="bg-[#1e293b] rounded-2xl p-6 border border-[#334155] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <h3 className="text-base font-bold text-slate-100 mb-4">Head-to-Head Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="text-left py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Metric</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#6366f1' }}>Random Forest</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#10b981' }}>XGBoost</th>
                  <th className="text-center py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Winner</th>
                </tr>
              </thead>
              <tbody>
                {['accuracy', 'precision', 'recall', 'f1'].map(metric => {
                  const rfVal = RF_MATRIX.metrics[metric]
                  const xgbVal = XGB_MATRIX.metrics[metric]
                  const winner = xgbVal > rfVal ? 'XGBoost' : rfVal > xgbVal ? 'Random Forest' : 'Tie'
                  const winColor = winner === 'XGBoost' ? '#10b981' : winner === 'Random Forest' ? '#6366f1' : '#94a3b8'
                  return (
                    <tr key={metric} className="border-b border-[#334155]/50">
                      <td className="py-3 text-slate-300 font-medium capitalize">{metric === 'f1' ? 'F1-Score' : metric}</td>
                      <td className="py-3 text-center font-mono font-bold tabular-nums" style={{ color: '#6366f1' }}>{rfVal}%</td>
                      <td className="py-3 text-center font-mono font-bold tabular-nums" style={{ color: '#10b981' }}>{xgbVal}%</td>
                      <td className="py-3 text-center text-xs font-semibold" style={{ color: winColor }}>{winner}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-indigo-500/5 rounded-2xl p-5 border border-indigo-500/20 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <p className="text-xs text-indigo-300 font-semibold mb-2">Model 2 — Deployment Notes</p>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span>Random Forest is deployed in production (Model 2) — evaluates 30 risk features per UPI transaction</li>
            <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span>XGBoost shows marginal improvement (+1.3% accuracy) but Random Forest was chosen for interpretability and faster inference</li>
            <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span>Both models trained on synthetic UPI fraud dataset with behavioral, device, and H.I.V.E. intelligence features</li>
            <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span>3-class classification: Legitimate (score 0-39), Suspicious (40-79), Fraudulent (80-100)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
