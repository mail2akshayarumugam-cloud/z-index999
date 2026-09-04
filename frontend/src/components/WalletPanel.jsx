import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  KPICard, StatusBreakdownChart, RiskDistributionChart,
  DailyVolumeChart, ScamTypeChart, AlertSeverityPills, useDashboardStats,
} from './charts/DashboardCharts'
import CreditCard from './CreditCard'

function DonutChart({ percentage, size = 120 }) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const used = Math.min(percentage, 100)
  const usedColor = used >= 80 ? '#ef4444' : used >= 50 ? '#f59e0b' : '#22c55e'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={usedColor} strokeWidth="12"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - used / 100)}
          style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold text-slate-900 tabular-nums font-mono">{Math.round(used)}%</span>
        <span className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Used</span>
      </div>
    </div>
  )
}

function SpendingRing({ label, amount, target, pct, color }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-gray-50 transition-all group cursor-default">
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 flex-shrink-0 group-hover:scale-105 transition-transform">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${pct}, 100`} style={{ transition: 'stroke-dasharray 1s ease-out' }} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-600">{pct}%</span>
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{label}</h4>
          <p className="text-[10px] text-slate-400 font-mono">{amount} / {target}</p>
        </div>
      </div>
    </div>
  )
}

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
  const [cardInfo, setCardInfo] = useState(null)

  const { stats, loading: statsLoading } = useDashboardStats()

  const refreshBalance = useCallback(() => {
    fetch(`/api/transactions/account/${user.id}`)
      .then(r => r.json())
      .then(d => {
        setBalance(d.balance)
        setLastUpdated(new Date())
        if (d.card_number) setCardInfo({ number: d.card_number, expiry: d.card_expiry, network: d.card_network, upi: d.upi_id })
      })
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
      return (t.beneficiary_upi?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.amount?.includes(q))
    }
    return true
  })

  const dailyPct = dailySpending?.percentage || 0
  const dailyColor = dailyPct >= 80 ? '#ef4444' : dailyPct >= 50 ? '#f59e0b' : '#22c55e'

  useEffect(() => { loadHistory(); loadBeneficiaries() }, [user.id])

  const fraudPrevented = stats?.fraud_prevented?.amount || 0
  const avgRisk = stats?.avg_risk_score || 0
  const totalTxns = stats?.total_transactions || 0
  const suspiciousCount = (stats?.risk_level_distribution?.HIGH || 0) + (stats?.risk_level_distribution?.CRITICAL || 0)

  return (
    <div className="h-full overflow-y-auto p-7 flex flex-col gap-6 bg-[#f0f2f5]">

      {/* Greeting */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-2xl lg:text-[28px] font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Welcome back, {user.name.split(' ')[0]} <span className="inline-block" style={{ animation: 'float 2.2s ease-in-out infinite' }}>👋</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Monitor your UPI transactions and stay protected from scams.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={refreshData} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-95 text-xs font-semibold text-slate-500 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
          <button onClick={() => navigate('/pay')} className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-sm hover:shadow-lg hover:shadow-emerald-500/20 font-semibold text-xs text-white transition-all active:scale-95">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            Send Money
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard label="Total Transactions" value={totalTxns} delay={0.1} color="#6366f1"
          icon={<svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}
          subtext={statsLoading ? 'Loading...' : `${stats?.txn_by_status?.committed?.count || 0} successful`} />
        <KPICard label="Suspicious" value={suspiciousCount} delay={0.2} color="#ef4444"
          icon={<svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>}
          subtext={`${stats?.risk_level_distribution?.CRITICAL || 0} critical`} />
        <KPICard label="Fraud Prevented" value={fraudPrevented} prefix="₹" delay={0.3} color="#f59e0b"
          icon={<svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
          subtext={`${stats?.fraud_prevented?.count || 0} blocked`} />
        <KPICard label="Avg Risk" value={avgRisk} suffix="%" decimals={1} delay={0.4}
          color={avgRisk >= 50 ? '#ef4444' : avgRisk >= 30 ? '#f59e0b' : '#22c55e'}
          icon={<svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
          subtext="from risk assessments" />
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* LEFT (8 cols) */}
        <div className="xl:col-span-8 flex flex-col gap-6">

          {/* Spending + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-[28px] p-6 shadow-sm border border-gray-200/60 flex flex-col justify-between animate-fade-in-up hover:shadow-lg transition-all group">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-base text-slate-800">Daily Spending</h2>
                {lastUpdated && <span className="text-[10px] text-slate-400">{lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
              <div className="flex items-center justify-between gap-4 my-auto">
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Available</p>
                    <p className="text-[28px] font-extrabold text-slate-900 font-mono tabular-nums leading-tight">
                      {balance !== null ? `₹${parseFloat(balance).toLocaleString('en-IN')}` : <span className="inline-block w-32 h-7 rounded-lg bg-gray-200 animate-pulse" />}
                    </p>
                  </div>
                  {dailySpending && (
                    <div className="text-[11px] text-slate-500">
                      Spent: <strong className="text-slate-900 font-mono">₹{dailySpending.spent_today.toLocaleString('en-IN')}</strong>
                      <span className="ml-2">Limit: <strong className="text-slate-900 font-mono">₹{dailySpending.daily_limit.toLocaleString('en-IN')}</strong></span>
                    </div>
                  )}
                </div>
                <div className="group-hover:scale-105 transition-transform flex-shrink-0"><DonutChart percentage={dailyPct} size={120} /></div>
              </div>
              <div className="flex items-center gap-5 mt-5 pt-3 border-t border-gray-200/60 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dailyColor }} />Spent ({dailyPct}%)</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500/40" />Remaining</div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-[28px] p-6 shadow-sm border border-gray-200/60 flex flex-col justify-between animate-fade-in-up hover:shadow-md transition-all" style={{ animationDelay: '80ms' }}>
              <h2 className="font-bold text-base text-slate-800 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3 flex-1">
                {[
                  { label: 'Send', sub: 'Pay anyone', color: 'indigo', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8', onClick: () => navigate('/pay') },
                  { label: 'Scan', sub: 'QR Code', color: 'emerald', icon: 'M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z', onClick: () => handleTab('scan') },
                  { label: 'Bills', sub: 'Contacts', color: 'cyan', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', onClick: () => handleTab('bills') },
                  { label: 'History', sub: 'All txns', color: 'purple', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', onClick: () => handleTab('history') },
                ].map(btn => (
                  <button key={btn.label} onClick={btn.onClick} className={`bg-gray-50/80 rounded-2xl p-3 border border-gray-100 flex items-center gap-2.5 hover:bg-${btn.color}-50 hover:border-${btn.color}-200 hover:-translate-y-1 hover:shadow-md transition-all group/item`}>
                    <span className={`w-9 h-9 rounded-xl bg-${btn.color}-500/15 flex items-center justify-center group-hover/item:scale-110 transition-all`}>
                      <svg className={`w-4 h-4 text-${btn.color}-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={btn.icon}/></svg>
                    </span>
                    <div><p className="text-[11px] font-bold text-slate-700">{btn.label}</p><p className="text-[9px] text-slate-400">{btn.sub}</p></div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-200/60 animate-fade-in-up hover:shadow-md transition-all" style={{ animationDelay: '120ms' }}>
              <h2 className="font-bold text-sm text-slate-900 mb-4">Risk Level Distribution</h2>
              {statsLoading ? <div className="h-32 flex items-center justify-center"><div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
                : <RiskDistributionChart data={stats?.risk_level_distribution || {}} />}
            </div>
            <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-200/60 animate-fade-in-up hover:shadow-md transition-all" style={{ animationDelay: '160ms' }}>
              <h2 className="font-bold text-sm text-slate-900 mb-4">Transaction Volume</h2>
              {statsLoading ? <div className="h-32 flex items-center justify-center"><div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
                : <DailyVolumeChart data={stats?.daily_volume || []} />}
            </div>
          </div>

          {/* Tab Content */}
          <section className="bg-white rounded-[28px] p-6 lg:p-7 shadow-sm border border-gray-200/60 animate-fade-in-up min-h-[280px] hover:shadow-md transition-all" style={{ animationDelay: '200ms' }}>
            {tab === 'scan' && (
              <div className="animate-fade-in text-center py-6">
                <h2 className="font-bold text-lg text-slate-900 mb-5">Scan & Pay</h2>
                <div className="w-48 h-48 mx-auto rounded-2xl bg-white p-3 shadow-lg shadow-gray-200/50 border border-gray-200 animate-scale-up">
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-700 mt-4">{user.name}</p>
                <p className="text-xs text-slate-400 font-mono mt-1">{user.upi}</p>
                <p className="text-[10px] text-amber-600 mt-3 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 inline-block">Demo QR only</p>
                <div className="mt-4"><button onClick={() => navigate('/pay')} className="px-6 py-2.5 rounded-full bg-emerald-50 text-emerald-600 text-sm font-semibold hover:bg-emerald-100 border border-emerald-200 transition-all">Enter UPI manually</button></div>
              </div>
            )}

            {(tab === 'history' || tab === 'home') && tab !== 'scan' && tab !== 'bills' && (
              <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-lg text-slate-900">Transaction History</h2>
                  <button onClick={loadHistory} className="text-[11px] text-indigo-500 hover:text-indigo-600 font-semibold transition-colors">Refresh</button>
                </div>
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 relative">
                    <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search UPI, description, amount..." className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-slate-700 placeholder-slate-400 text-xs focus:outline-none focus:border-indigo-500/50 transition-colors" />
                  </div>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-slate-600 text-xs focus:outline-none focus:border-indigo-500/50">
                    <option value="all">All</option><option value="committed">Committed</option><option value="evaluated">Pending</option><option value="blocked">Blocked</option>
                  </select>
                </div>
                {loadingHistory ? (
                  <div className="text-center py-12"><div className="w-6 h-6 mx-auto border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">{searchQuery || statusFilter !== 'all' ? 'No matching transactions' : 'No transactions yet'}</div>
                ) : (
                  <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}>
                    {filteredHistory.map(t => {
                      const amt = parseFloat(t.amount)
                      const statusColor = t.status === 'committed' ? 'text-emerald-500' : t.status === 'blocked' ? 'text-red-500' : 'text-amber-500'
                      const riskColor = t.risk_level === 'CRITICAL' ? 'bg-red-600 text-white' : t.risk_level === 'HIGH' ? 'bg-red-500/80 text-white' : t.risk_level === 'MEDIUM' ? 'bg-amber-500/80 text-white' : t.risk_level === 'LOW' ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/20' : null
                      return (
                        <div key={t.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-all">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${t.status === 'committed' ? 'bg-emerald-500/10' : t.status === 'blocked' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                            {t.status === 'committed' ? <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                              : t.status === 'blocked' ? <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                              : <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-slate-700 font-mono truncate">{t.beneficiary_upi}</p>
                              {riskColor && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${riskColor}`}>{t.risk_level}</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] font-semibold ${statusColor}`}>{t.status}</span>
                              {t.created_at && <span className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                            </div>
                          </div>
                          <p className="text-sm font-bold text-slate-700 flex-shrink-0 font-mono tabular-nums">-₹{amt.toLocaleString('en-IN')}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'bills' && (
              <div className="animate-fade-in">
                <h2 className="font-bold text-lg text-slate-900 mb-5">Beneficiaries ({beneficiaries.length})</h2>
                {loadingBens ? <div className="text-center py-12"><div className="w-6 h-6 mx-auto border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>
                  : beneficiaries.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">No beneficiaries found</div>
                  : <div className="space-y-2">{beneficiaries.map(b => (
                    <button key={b.id} onClick={() => navigate('/pay')} className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all text-left">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-600 font-bold text-sm flex-shrink-0">{b.name[0]}</div>
                      <div className="flex-1 min-w-0"><p className="text-sm text-slate-700 font-medium truncate">{b.name}</p><p className="text-[11px] text-slate-400 font-mono truncate">{b.upi_id}</p></div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${b.verified ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/15 text-amber-600 border border-amber-500/20'}`}>{b.verified ? 'Verified' : 'New'}</span>
                    </button>
                  ))}</div>}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT (4 cols) */}
        <div className="xl:col-span-4 flex flex-col gap-6">

          {/* Credit Card — stays dark */}
          <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-200/60 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm text-slate-900">My Card</h2>
              <span className="text-[10px] text-slate-400">Linked to UPI</span>
            </div>
            <CreditCard name={user.name} cardNumber={cardInfo?.number} expiry={cardInfo?.expiry} network={cardInfo?.network} upi={cardInfo?.upi} />
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="bg-red-50 rounded-[28px] p-5 border border-red-200/60 animate-fade-in-up animate-risk-pulse" style={{ animationDelay: '120ms' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
                </div>
                <span className="text-sm font-bold text-red-600">H.I.V.E. Threats ({alerts.length})</span>
              </div>
              {alerts.slice(0, 3).map((alert, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <p className="text-xs text-red-600/80">{alert.explanation}</p>
                  {alert.entities?.upi_ids?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                      {alert.entities.upi_ids.map((upi, j) => <span key={j} className="text-[10px] px-2 py-0.5 rounded-md bg-red-100 text-red-600 font-mono border border-red-200">{upi}</span>)}
                      {alert.entities.upi_ids.map((upi, j) => <button key={`r${j}`} onClick={() => reportUpi(upi, alert.type)} disabled={reporting === upi} className="text-[10px] px-2.5 py-1 rounded-md bg-red-600 text-white font-bold hover:bg-red-500 hover:scale-105 transition-all disabled:opacity-50">{reporting === upi ? 'Done' : 'Report'}</button>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Status Breakdown */}
          <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-200/60 animate-fade-in-up hover:shadow-md transition-all" style={{ animationDelay: '160ms' }}>
            <h2 className="font-bold text-sm text-slate-900 mb-4">Transaction Status</h2>
            {statsLoading ? <div className="h-24 flex items-center justify-center"><div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
              : <StatusBreakdownChart data={stats?.txn_by_status || {}} />}
          </div>

          {/* Scam Types */}
          {stats?.scam_type_distribution && Object.keys(stats.scam_type_distribution).length > 0 && (
            <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-200/60 animate-fade-in-up hover:shadow-md transition-all" style={{ animationDelay: '200ms' }}>
              <h2 className="font-bold text-sm text-slate-900 mb-4">Scam Types Detected</h2>
              <ScamTypeChart data={stats.scam_type_distribution} />
            </div>
          )}

          {/* System Metrics */}
          <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-200/60 animate-fade-in-up hover:shadow-md transition-all" style={{ animationDelay: '240ms' }}>
            <h2 className="font-bold text-sm text-slate-900 mb-3">System Metrics</h2>
            <div className="space-y-1">
              <SpendingRing label="Daily Limit" amount={dailySpending ? `₹${dailySpending.spent_today.toLocaleString('en-IN')}` : '₹0'} target={dailySpending ? `₹${dailySpending.daily_limit.toLocaleString('en-IN')}` : '₹50,000'} pct={dailyPct} color={dailyColor} />
              <SpendingRing label="Avg Risk Score" amount={`${avgRisk.toFixed(1)}%`} target="of 100" pct={Math.round(avgRisk)} color={avgRisk >= 50 ? '#ef4444' : avgRisk >= 30 ? '#f59e0b' : '#22c55e'} />
              <SpendingRing label="Verified Contacts" amount={`${beneficiaries.filter(b => b.verified).length}`} target={`${beneficiaries.length} total`} pct={beneficiaries.length > 0 ? Math.round(beneficiaries.filter(b => b.verified).length / beneficiaries.length * 100) : 0} color="#6366f1" />
            </div>
          </div>

          {/* Alert Severity */}
          {stats?.alert_severity && Object.keys(stats.alert_severity).length > 0 && (
            <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-200/60 animate-fade-in-up hover:shadow-md transition-all" style={{ animationDelay: '280ms' }}>
              <h2 className="font-bold text-sm text-slate-900 mb-3">Alert Severity</h2>
              <AlertSeverityPills data={stats.alert_severity} />
            </div>
          )}

          {/* Notifications */}
          {(dbNotifs.length > 0 || notifications.length > 0) && (
            <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-200/60 animate-fade-in-up hover:shadow-md transition-all" style={{ animationDelay: '320ms' }}>
              <h2 className="font-bold text-sm text-slate-900 mb-3">Recent Alerts</h2>
              <div className="space-y-2 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}>
                {notifications.map((n, i) => (
                  <div key={`live-${i}`} className="p-3 rounded-xl bg-red-50 border border-red-200/60">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" /></span>
                      <p className="text-xs font-bold text-red-600">{n.title}</p>
                    </div>
                    <p className="text-[11px] text-slate-500">{n.body}</p>
                  </div>
                ))}
                {dbNotifs.slice(0, 5).map(n => {
                  const c = { critical: '#dc2626', high: '#ea580c', warning: '#d97706', info: '#64748b' }
                  const color = c[n.severity] || c.info
                  return (
                    <div key={n.id} className="p-3 rounded-xl border" style={{ backgroundColor: color + '08', borderColor: color + '20' }}>
                      <p className="text-xs font-bold" style={{ color }}>{n.title}</p>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{n.body}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
