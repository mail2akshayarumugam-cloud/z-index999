import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser, logoutUser } from '../user'
import WalletPanel from '../components/WalletPanel'

export default function MainView() {
  const user = getUser()
  const navigate = useNavigate()
  const [hiveAlerts, setHiveAlerts] = useState([])
  const [hiveSynced, setHiveSynced] = useState(0)
  const [hiveConnected, setHiveConnected] = useState(false)

  useEffect(() => {
    let interval
    async function checkHive() {
      try {
        const resp = await fetch('/api/health')
        const data = await resp.json()
        setHiveConnected(data.status === 'healthy')

        const sigResp = await fetch(`/api/risk/signals/${user.id}?hours=24`)
        if (sigResp.ok) {
          const signals = await sigResp.json()
          const liveSignals = signals.filter(s => s.source === 'hive_live' || s.source === 'hive')
          setHiveSynced(liveSignals.length)
          const newAlerts = liveSignals
            .filter(s => !hiveAlerts.find(a => a.entity === s.entity_value))
            .map(s => ({
              id: s.id,
              entity: s.entity_value,
              type: s.scam_type,
              severity: s.severity,
              explanation: `H.I.V.E. flagged ${s.entity_type}: ${s.entity_value} (${s.scam_type || 'suspicious'})`,
              entities: { upi_ids: s.entity_type === 'upi_id' ? [s.entity_value] : [] },
            }))
          if (newAlerts.length > 0) {
            setHiveAlerts(prev => [...newAlerts, ...prev])
          }
        }
      } catch {}
    }
    checkHive()
    interval = setInterval(checkHive, 10000)
    return () => clearInterval(interval)
  }, [user.id])

  function handleLogout() {
    logoutUser()
    navigate('/login')
  }

  return (
    <div className="h-screen flex flex-col bg-[#0b1120]">
      {/* Top bar */}
      <div className="h-12 glass flex items-center px-5 gap-3 flex-shrink-0 z-10 border-b border-white/[0.04]">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-slate-200 tracking-tight">Scam Shield</span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-slate-700/60 mx-1" />

        {/* Status badges */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2.5 w-2.5">
              {hiveConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${hiveConnected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold tracking-wide">
              H.I.V.E. {hiveConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          <span className="text-[11px] bg-indigo-500/15 text-indigo-400 px-2.5 py-1 rounded-full font-semibold border border-indigo-500/20">
            Model 2
          </span>

          {hiveSynced > 0 && (
            <span className="text-[11px] bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full font-bold border border-red-500/20 animate-pulse">
              {hiveSynced} signal{hiveSynced > 1 ? 's' : ''} synced
            </span>
          )}
        </div>

        <button
          onClick={() => navigate('/mail')}
          className="flex items-center gap-1.5 text-[11px] bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full font-medium border border-purple-500/20 hover:bg-purple-500/20 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
          Mail
        </button>

        <div className="flex-1" />

        {/* Right side */}
        {hiveAlerts.length > 0 && (
          <span className="text-[11px] bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full font-bold animate-risk-pulse border border-red-500/20">
            {hiveAlerts.length} threat{hiveAlerts.length > 1 ? 's' : ''}
          </span>
        )}
        <div className="w-px h-5 bg-slate-700/60 mx-1" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-[10px] font-bold">
            {user?.name?.[0]}
          </div>
          <span className="text-[12px] text-slate-400 font-medium">{user?.name}</span>
        </div>
        <button onClick={handleLogout} className="text-[11px] text-slate-600 hover:text-slate-300 transition-colors ml-1">
          Logout
        </button>
      </div>

      {/* Full-width wallet */}
      <div className="flex-1 overflow-hidden bg-grid">
        <WalletPanel user={user} alerts={hiveAlerts} notifications={[]} />
      </div>
    </div>
  )
}
