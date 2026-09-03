import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const TABS = ['home', 'scan', 'bills', 'history']

export default function WalletPanel({ user, alerts = [], notifications = [] }) {
  const navigate = useNavigate()
  const [balance, setBalance] = useState(null)
  const [dbNotifs, setDbNotifs] = useState([])
  const [tab, setTab] = useState('home')
  const [history, setHistory] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingBens, setLoadingBens] = useState(false)
  const [dailySpending, setDailySpending] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [reporting, setReporting] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const refreshBalance = useCallback(() => {
    fetch(`/api/transactions/account/${user.id}`)
      .then(r => r.json())
      .then(d => { setBalance(d.balance); setLastUpdated(new Date()) })
      .catch(() => {})
    fetch(`/api/transactions/daily-spending/${user.id}`)
      .then(r => r.json())
      .then(setDailySpending)
      .catch(() => {})
  }, [user.id])

  function refreshData() {
    refreshBalance()
    fetch(`/api/notifications/${user.id}`)
      .then(r => r.json())
      .then(setDbNotifs)
      .catch(() => {})
  }

  useEffect(() => { refreshData() }, [user.id])
  useEffect(() => { if (notifications.length > 0) refreshData() }, [notifications.length])

  useEffect(() => {
    const interval = setInterval(refreshBalance, 15000)
    return () => clearInterval(interval)
  }, [refreshBalance])

  function loadHistory() {
    setLoadingHistory(true)
    fetch(`/api/transactions/history/${user.id}`)
      .then(r => r.json())
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }

  function loadBeneficiaries() {
    setLoadingBens(true)
    fetch(`/api/transactions/beneficiaries/${user.id}`)
      .then(r => r.json())
      .then(setBeneficiaries)
      .catch(() => {})
      .finally(() => setLoadingBens(false))
  }

  function handleTab(t) {
    setTab(t)
    if (t === 'history' && history.length === 0) loadHistory()
    if (t === 'bills' && beneficiaries.length === 0) loadBeneficiaries()
  }

  async function reportUpi(upiId, scamType) {
    setReporting(upiId)
    try {
      await fetch('/api/risk/report-upi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upi_id: upiId, user_id: user.id, scam_type: scamType || 'user_reported' }),
      })
    } catch {}
    setTimeout(() => setReporting(null), 2000)
  }

  const filteredHistory = history.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (t.beneficiary_upi?.toLowerCase().includes(q) ||
              t.description?.toLowerCase().includes(q) ||
              t.amount?.includes(q))
    }
    return true
  })

  const dailyPct = dailySpending?.percentage || 0
  const dailyColor = dailyPct >= 80 ? '#ef4444' : dailyPct >= 50 ? '#f59e0b' : '#22c55e'

  return (
    <div className="h-full flex flex-col bg-[#0b1120] overflow-y-auto">
      {/* Header */}
      <div className="p-6 pb-4 bg-glow-indigo">
        <div className="flex items-center gap-3 mb-5 animate-fade-in">
          <button onClick={() => navigate('/profile')} className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-105 transition-all">
            {user.name[0]}
          </button>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-slate-100">{user.name}</p>
            <p className="text-[12px] text-slate-500 font-mono">{user.upi}</p>
          </div>
          <button onClick={() => navigate('/profile')} className="w-9 h-9 rounded-lg bg-[#1e293b]/60 hover:bg-[#1e293b] flex items-center justify-center transition-all border border-[#334155]/50">
            <svg className="w-4.5 h-4.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>

        {/* Balance card */}
        <div className="glass-strong rounded-2xl p-5 animate-fade-in-up card-hover group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold">Available Balance</p>
            {lastUpdated && (
              <p className="text-[10px] text-slate-600">
                Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <p className="text-[34px] font-extrabold text-slate-50 font-mono tabular-nums leading-tight">
            {balance !== null ? `₹${parseFloat(balance).toLocaleString('en-IN')}` : (
              <span className="inline-block w-40 h-8 rounded-lg bg-slate-700/40 animate-pulse" />
            )}
          </p>

          {dailySpending && (
            <div className="mt-4">
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-slate-500 font-medium">Daily spending limit</span>
                <span className="text-slate-400 font-mono tabular-nums">
                  ₹{dailySpending.spent_today.toLocaleString('en-IN')}
                  <span className="text-slate-600"> / </span>
                  ₹{dailySpending.daily_limit.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="h-2 bg-[#0f172a]/80 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${dailyPct}%`,
                    background: `linear-gradient(90deg, ${dailyColor}cc, ${dailyColor})`,
                    boxShadow: `0 0 8px ${dailyColor}40`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* H.I.V.E. alerts */}
      {alerts.length > 0 && (
        <div className="px-6 pb-4 animate-fade-in">
          <div className="bg-red-500/[0.07] border border-red-500/25 rounded-xl p-4 animate-risk-pulse">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <span className="text-sm font-bold text-red-400">H.I.V.E. Alert — {alerts.length} threat{alerts.length > 1 ? 's' : ''} detected</span>
            </div>
            {alerts.slice(0, 3).map((alert, i) => (
              <div key={i} className="mb-2.5 last:mb-0">
                <p className="text-xs text-red-300/90">{alert.explanation}</p>
                {alert.entities?.upi_ids?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                    {alert.entities.upi_ids.map((upi, j) => (
                      <span key={j} className="text-[11px] px-2 py-0.5 rounded-md bg-red-500/15 text-red-300 font-mono border border-red-500/20">{upi}</span>
                    ))}
                    {alert.entities.upi_ids.map((upi, j) => (
                      <button
                        key={`r${j}`}
                        onClick={() => reportUpi(upi, alert.type)}
                        disabled={reporting === upi}
                        className="text-[11px] px-3 py-1 rounded-md bg-red-600 text-white font-bold hover:bg-red-500 hover:scale-105 transition-all disabled:opacity-50 shadow-sm shadow-red-500/20"
                      >
                        {reporting === upi ? '✓ Reported' : 'Report UPI'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <p className="text-[10px] text-red-400/50 mt-3 pt-2 border-t border-red-500/10">Model 2 will automatically block payments to flagged entities.</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-6 pb-5">
        <div className="grid grid-cols-4 gap-3">
          {/* Send button */}
          <button
            onClick={() => navigate('/pay')}
            className="flex flex-col items-center gap-2.5 p-3.5 rounded-xl bg-[#1e293b]/80 border border-[#334155] hover:border-indigo-500/30 hover:bg-indigo-500/[0.06] hover:scale-[1.03] transition-all group animate-fade-in-up"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-500/15 flex items-center justify-center group-hover:bg-indigo-500/25 group-hover:shadow-lg group-hover:shadow-indigo-500/10 transition-all">
              <svg className="w-5.5 h-5.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </div>
            <span className="text-[11px] text-slate-300 font-semibold">Send</span>
          </button>

          {/* Scan button */}
          <button
            onClick={() => handleTab(tab === 'scan' ? 'home' : 'scan')}
            className={`flex flex-col items-center gap-2.5 p-3.5 rounded-xl border hover:scale-[1.03] transition-all group animate-fade-in-up delay-100 ${
              tab === 'scan'
                ? 'bg-emerald-500/[0.08] border-emerald-500/30'
                : 'bg-[#1e293b]/80 border-[#334155] hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              tab === 'scan' ? 'bg-emerald-500/20 shadow-lg shadow-emerald-500/10' : 'bg-slate-500/10 group-hover:bg-emerald-500/15'
            }`}>
              <svg className={`w-5.5 h-5.5 ${tab === 'scan' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-400'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>
            </div>
            <span className={`text-[11px] font-semibold ${tab === 'scan' ? 'text-emerald-400' : 'text-slate-400'}`}>Scan</span>
          </button>

          {/* Bills button */}
          <button
            onClick={() => handleTab(tab === 'bills' ? 'home' : 'bills')}
            className={`flex flex-col items-center gap-2.5 p-3.5 rounded-xl border hover:scale-[1.03] transition-all group animate-fade-in-up delay-200 ${
              tab === 'bills'
                ? 'bg-cyan-500/[0.08] border-cyan-500/30'
                : 'bg-[#1e293b]/80 border-[#334155] hover:border-cyan-500/30 hover:bg-cyan-500/[0.04]'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              tab === 'bills' ? 'bg-cyan-500/20 shadow-lg shadow-cyan-500/10' : 'bg-slate-500/10 group-hover:bg-cyan-500/15'
            }`}>
              <svg className={`w-5.5 h-5.5 ${tab === 'bills' ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-400'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
            </div>
            <span className={`text-[11px] font-semibold ${tab === 'bills' ? 'text-cyan-400' : 'text-slate-400'}`}>Bills</span>
          </button>

          {/* History button */}
          <button
            onClick={() => handleTab(tab === 'history' ? 'home' : 'history')}
            className={`flex flex-col items-center gap-2.5 p-3.5 rounded-xl border hover:scale-[1.03] transition-all group animate-fade-in-up delay-300 ${
              tab === 'history'
                ? 'bg-purple-500/[0.08] border-purple-500/30'
                : 'bg-[#1e293b]/80 border-[#334155] hover:border-purple-500/30 hover:bg-purple-500/[0.04]'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              tab === 'history' ? 'bg-purple-500/20 shadow-lg shadow-purple-500/10' : 'bg-slate-500/10 group-hover:bg-purple-500/15'
            }`}>
              <svg className={`w-5.5 h-5.5 ${tab === 'history' ? 'text-purple-400' : 'text-slate-400 group-hover:text-purple-400'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className={`text-[11px] font-semibold ${tab === 'history' ? 'text-purple-400' : 'text-slate-400'}`}>History</span>
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 flex-1 pb-6">

        {/* SCAN tab — QR code */}
        {tab === 'scan' && (
          <div className="animate-fade-in">
            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">Scan & Pay</h3>
            <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6 text-center">
              <div className="w-52 h-52 mx-auto rounded-2xl bg-white p-3 mb-4 animate-scale-up shadow-xl shadow-black/20">
                <div className="w-full h-full relative">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <rect x="5" y="5" width="25" height="25" rx="3" fill="#1e293b" />
                    <rect x="8" y="8" width="19" height="19" rx="1" fill="white" />
                    <rect x="11" y="11" width="13" height="13" rx="1" fill="#1e293b" />
                    <rect x="70" y="5" width="25" height="25" rx="3" fill="#1e293b" />
                    <rect x="73" y="8" width="19" height="19" rx="1" fill="white" />
                    <rect x="76" y="11" width="13" height="13" rx="1" fill="#1e293b" />
                    <rect x="5" y="70" width="25" height="25" rx="3" fill="#1e293b" />
                    <rect x="8" y="73" width="19" height="19" rx="1" fill="white" />
                    <rect x="11" y="76" width="13" height="13" rx="1" fill="#1e293b" />
                    {[35,40,45,50,55,60].map(x => [5,10,15,35,40,50,55,65,70,80,85,90].map(y => (
                      <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" fill={((x+y) % 10 < 6) ? '#1e293b' : 'white'} />
                    )))}
                    {[5,10,15,20,35,45,55,65,75,85].map(y => [35,40,45,50,55,60].map(x => (
                      <rect key={`v${x}-${y}`} x={y} y={x} width="4" height="4" fill={((x*y) % 10 < 5) ? '#1e293b' : 'white'} />
                    )))}
                    <rect x="70" y="70" width="10" height="10" fill="#1e293b" rx="2" />
                    <rect x="82" y="70" width="8" height="4" fill="#1e293b" />
                    <rect x="70" y="82" width="4" height="8" fill="#1e293b" />
                    <rect x="82" y="82" width="8" height="8" fill="#1e293b" rx="2" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-lg bg-white border-2 border-[#1e293b] flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-200">{user.name}</p>
              <p className="text-xs text-slate-400 font-mono mt-1">{user.upi}</p>
              <p className="text-[10px] text-amber-400/80 mt-3 px-4 py-1.5 rounded-full bg-amber-500/10 inline-block border border-amber-500/15">This QR is for demo purposes only</p>
              <div className="mt-4">
                <button onClick={() => navigate('/pay')} className="px-6 py-2.5 rounded-lg bg-emerald-600/20 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 transition-colors border border-emerald-500/20">
                  Enter UPI manually
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BILLS tab */}
        {tab === 'bills' && (
          <div className="animate-fade-in">
            <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-3">Beneficiaries ({beneficiaries.length})</h3>
            {loadingBens ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 mx-auto border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                <p className="text-slate-500 text-sm mt-3">Loading beneficiaries...</p>
              </div>
            ) : beneficiaries.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">No beneficiaries found</div>
            ) : (
              <div className="space-y-2">
                {beneficiaries.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={() => navigate('/pay')}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-[#1e293b]/80 border border-[#334155] hover:border-cyan-500/30 hover:bg-cyan-500/[0.04] transition-all text-left animate-fade-in"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="w-10 h-10 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-400 font-bold text-sm flex-shrink-0">{b.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 font-medium truncate">{b.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{b.upi_id}</p>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${b.verified ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'}`}>
                      {b.verified ? 'Verified' : 'Unverified'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORY tab */}
        {tab === 'history' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Transactions ({filteredHistory.length})</h3>
              <button onClick={loadHistory} className="text-[11px] text-purple-400 hover:text-purple-300 font-medium transition-colors">Refresh</button>
            </div>

            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <svg className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search UPI, description, amount..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#1e293b] border border-[#334155] text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[#1e293b] border border-[#334155] text-slate-300 text-xs focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="all">All</option>
                <option value="committed">Committed</option>
                <option value="evaluated">Pending</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 mx-auto border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                <p className="text-slate-500 text-sm mt-3">Loading transactions...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">{searchQuery || statusFilter !== 'all' ? 'No matching transactions' : 'No transactions yet'}</div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((t, i) => {
                  const amt = parseFloat(t.amount)
                  const statusColor = t.status === 'committed' ? 'text-green-400' : t.status === 'blocked' ? 'text-red-400' : 'text-amber-400'
                  const riskColor = t.risk_level === 'CRITICAL' ? 'bg-red-600 text-white' : t.risk_level === 'HIGH' ? 'bg-red-500/80 text-white' : t.risk_level === 'MEDIUM' ? 'bg-amber-500/80 text-white' : t.risk_level === 'LOW' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : null
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-[#1e293b]/80 border border-[#334155] card-hover animate-fade-in"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${t.status === 'committed' ? 'bg-green-500/10' : t.status === 'blocked' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                        {t.status === 'committed' ? (
                          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : t.status === 'blocked' ? (
                          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        ) : (
                          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-200 font-mono truncate">{t.beneficiary_upi}</p>
                          {riskColor && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${riskColor}`}>{t.risk_level}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-semibold ${statusColor}`}>{t.status}</span>
                          {t.description && <span className="text-[10px] text-slate-600 truncate">{t.description}</span>}
                        </div>
                        {t.created_at && <p className="text-[10px] text-slate-600 mt-0.5">{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} {new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>}
                      </div>
                      <p className="text-sm font-bold text-slate-200 flex-shrink-0 font-mono tabular-nums">-₹{amt.toLocaleString('en-IN')}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* HOME tab — Notifications */}
        {tab === 'home' && (
          <div className="animate-fade-in">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notifications</h3>
            {dbNotifs.length === 0 && notifications.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1e293b]/60 flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </div>
                <p className="text-sm text-slate-500 font-medium">No notifications</p>
                <p className="text-[11px] text-slate-600 mt-1">Scan a message in WhatsApp to see alerts</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((n, i) => (
                  <div key={`live-${i}`} className="p-3.5 rounded-xl bg-red-500/[0.07] border border-red-500/20 animate-fade-in">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
                      </span>
                      <p className="text-xs font-bold text-red-400">{n.title}</p>
                    </div>
                    <p className="text-[11px] text-slate-400">{n.body}</p>
                  </div>
                ))}
                {dbNotifs.slice(0, 8).map((n, i) => {
                  const colors = {
                    critical: { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', text: '#f87171', icon: '🔴' },
                    high: { bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.2)', text: '#fb923c', icon: '🟠' },
                    warning: { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', text: '#fbbf24', icon: '🟡' },
                    info: { bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.2)', text: '#94a3b8', icon: '🔵' },
                  }
                  const c = colors[n.severity] || colors.info
                  return (
                    <div
                      key={n.id}
                      className="p-3.5 rounded-xl border animate-fade-in"
                      style={{ backgroundColor: c.bg, borderColor: c.border, animationDelay: `${i * 60}ms` }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-bold" style={{ color: c.text }}>{n.title}</p>
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{n.body}</p>
                          <p className="text-[10px] text-slate-600 mt-1.5">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                          {n.severity}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
