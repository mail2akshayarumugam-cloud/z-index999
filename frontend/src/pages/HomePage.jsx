import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const USER = { id: 'user-arjun', name: 'Arjun Kumar', phone: '+91 98450 12345', upi: 'arjun.kumar7@okicici' }
const DEVICE_ID = 'dev-arjun-pixel'

export default function HomePage() {
  const navigate = useNavigate()
  const [health, setHealth] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [balance] = useState(10000)

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => {})
    fetch(`/api/notifications/${USER.id}`).then(r => r.json()).then(setNotifications).catch(() => {})
  }, [])

  const securityOk = health?.status === 'healthy'
  const alertCount = notifications.filter(n => n.severity !== 'info').length

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm">Welcome back</p>
            <h1 className="text-2xl font-bold mt-1">{USER.name}</h1>
            <p className="text-indigo-200 text-sm mt-1">{USER.upi}</p>
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-sm">Available Balance</p>
            <p className="text-3xl font-bold mt-1">Rs {balance.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => navigate('/send')} className="bg-[#1e293b] border border-[#334155] rounded-xl p-5 text-center hover:bg-[#334155] transition-colors group">
          <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500/20 flex items-center justify-center mb-3 group-hover:bg-indigo-500/30">
            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <p className="font-medium text-slate-200">Send Money</p>
          <p className="text-xs text-slate-500 mt-1">UPI Payment</p>
        </button>

        <button onClick={() => navigate('/alerts')} className="bg-[#1e293b] border border-[#334155] rounded-xl p-5 text-center hover:bg-[#334155] transition-colors group relative">
          {alertCount > 0 && (
            <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center text-white">{alertCount}</span>
          )}
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="font-medium text-slate-200">H.I.V.E. Alerts</p>
          <p className="text-xs text-slate-500 mt-1">Scam Detection</p>
        </button>

        <button onClick={() => navigate('/timeline')} className="bg-[#1e293b] border border-[#334155] rounded-xl p-5 text-center hover:bg-[#334155] transition-colors group">
          <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500/20 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-medium text-slate-200">Timeline</p>
          <p className="text-xs text-slate-500 mt-1">Security Events</p>
        </button>

        <button onClick={() => navigate('/dashboard')} className="bg-[#1e293b] border border-[#334155] rounded-xl p-5 text-center hover:bg-[#334155] transition-colors group">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <p className="font-medium text-slate-200">Bank Ops</p>
          <p className="text-xs text-slate-500 mt-1">Fraud Dashboard</p>
        </button>
      </div>

      {/* Security Status + Recent Alerts */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
          <h2 className="font-semibold text-slate-200 mb-4">Security Status</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${securityOk ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm text-slate-300">System Status: {securityOk ? 'All systems operational' : 'Checking...'}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-slate-300">H.I.V.E. Model 1: Active</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-slate-300">Risk Engine Model 2: Active (ml-v1)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-sm text-slate-300">Pre-Transaction Gate: Enabled</span>
            </div>
          </div>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Recent Alerts</h2>
            {alertCount > 0 && (
              <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{alertCount} active</span>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500">No recent alerts</p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 3).map(n => (
                <div key={n.id} className={`p-3 rounded-lg border text-sm ${
                  n.severity === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                  n.severity === 'high' ? 'bg-orange-500/10 border-orange-500/30 text-orange-300' :
                  n.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                  'bg-slate-500/10 border-slate-500/30 text-slate-400'
                }`}>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs mt-1 opacity-75">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
