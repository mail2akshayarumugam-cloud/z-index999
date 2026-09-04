import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser, logoutUser } from '../user'

export default function ProfilePage() {
  const user = getUser()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/auth/profile/${user.id}`)
      .then(r => r.json())
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user.id])

  if (loading) return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Loading profile...</p>
      </div>
    </div>
  )
  if (!profile) return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
      <div className="text-center">
        <svg className="w-12 h-12 text-red-400/50 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
        <p className="text-red-400">Failed to load profile</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f0f2f5] bg-grid">
      {/* Header */}
      <div className="h-14 glass flex items-center px-5 gap-3 animate-fade-in-down">
        <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center transition-all">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        <span className="text-sm font-semibold text-slate-700">Profile & Security</span>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-5">
        {/* User hero card */}
        <div className="glass-strong rounded-2xl p-6 animate-fade-in-up bg-glow-indigo">
          <div className="flex items-center gap-5">
            <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-indigo-500/20" style={{ width: '72px', height: '72px' }}>
              {profile.name[0]}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900">{profile.name}</h2>
              <p className="text-sm text-indigo-400 font-mono mt-0.5">{profile.upi}</p>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Balance</p>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">₹{parseFloat(profile.balance).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* Account details */}
        <div className="glass rounded-xl p-5 animate-fade-in-up delay-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Account Details</h3>
          <div className="grid grid-cols-2 gap-y-4 gap-x-6">
            {[
              { label: 'Email', value: profile.email, icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
              { label: 'Phone', value: profile.phone, icon: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z' },
              { label: 'UPI ID', value: profile.upi },
              { label: 'Account Type', value: profile.account_type || 'Savings' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-2">
                <div className="mt-0.5">
                  {item.icon ? (
                    <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                  ) : (
                    <div className="w-3.5 h-3.5" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm text-slate-300 font-mono mt-0.5">{item.value || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Linked devices */}
        <div className="glass rounded-xl p-5 animate-fade-in-up delay-200">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Linked Devices ({profile.devices.length})</h3>
          <div className="space-y-3">
            {profile.devices.map((d, idx) => (
              <div key={d.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50/50 border border-gray-200/50 card-hover animate-fade-in" style={{ animationDelay: `${idx * 80}ms` }}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.trusted ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  <svg className={`w-5 h-5 ${d.trusted ? 'text-emerald-400' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-700 font-medium">{d.name}</p>
                  <p className="text-[10px] text-slate-500">{d.platform} — last seen {d.last_seen ? new Date(d.last_seen).toLocaleDateString('en-IN') : '—'}</p>
                </div>
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${d.trusted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {d.trusted ? 'Trusted' : 'Untrusted'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Login history */}
        <div className="glass rounded-xl p-5 animate-fade-in-up delay-300">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Login Activity</h3>
          <div className="space-y-2">
            {profile.login_history.map((l, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-200/30 last:border-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${l.event_type === 'login_success' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(52,211,153,0.5)]' : 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]'}`} />
                <span className="text-sm text-slate-400 flex-1">
                  {l.event_type === 'login_success' ? 'Login' : 'Failed login'} from <span className="font-mono text-slate-300">{l.ip_address}</span>
                </span>
                <span className="text-[10px] text-slate-600 font-mono">{l.timestamp ? new Date(l.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security settings */}
        <div className="glass rounded-xl p-5 animate-fade-in-up delay-400">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Security Settings</h3>
          <div className="space-y-1">
            {[
              { label: 'UPI PIN', desc: 'Required for all transactions', icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z', enabled: true },
              { label: 'H.I.V.E. Protection', desc: 'Scam detection on incoming messages', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', enabled: true },
              { label: 'Model 2 Risk Gate', desc: 'ML pre-transaction risk evaluation', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5', enabled: true },
              { label: 'Session Timeout', desc: 'Auto-logout after 5 min inactivity', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', enabled: true },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 py-3 border-b border-gray-200/30 last:border-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={s.icon} /></svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-300 font-medium">{s.label}</p>
                  <p className="text-[10px] text-slate-600">{s.desc}</p>
                </div>
                <div className={`w-10 h-5.5 rounded-full relative cursor-default ${s.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`} style={{ height: '22px' }}>
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-[3px] transition-all shadow-sm ${s.enabled ? 'left-[22px]' : 'left-[3px]'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => { logoutUser(); navigate('/login') }}
          className="w-full py-3.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all text-sm font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
          Logout
        </button>
      </div>
    </div>
  )
}
