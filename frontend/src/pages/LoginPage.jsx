import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { loginUser } from '../user'

const DEMO_CREDS = [
  { label: 'Arjun Kumar', sub: 'Software Engineer', email: 'arjun.kumar7@gmail.com', password: 'arjun@123', color: 'from-indigo-600 to-indigo-400' },
  { label: 'Neha Gupta', sub: 'Marketing Pro', email: 'neha.gupta92@gmail.com', password: 'neha@123', color: 'from-cyan-600 to-cyan-400' },
  { label: 'Vikram Reddy', sub: 'Consultant', email: 'vikram.reddy@proton.me', password: 'vikram@123', color: 'from-red-600 to-red-400' },
  { label: 'Rajesh Mehta', sub: 'CFO (Authority)', email: 'rajesh.mehta@company.com', password: 'admin@123', color: 'from-amber-600 to-amber-400' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionExpired = location.state?.reason
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    if (!identifier || !password) { setError('Enter email/phone and password'); return }
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Login failed')
      loginUser({
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role || 'user',
        upi: data.upi,
        deviceId: data.id === 'user-arjun' ? 'dev-arjun-pixel' :
                  data.id === 'user-neha' ? 'dev-neha-iphone' :
                  data.id === 'user-vikram' ? 'dev-vikram-android' :
                  null,
        avatar: data.name[0],
      })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function fillCreds(c) {
    setIdentifier(c.email)
    setPassword(c.password)
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] bg-grid flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-glow-indigo pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center mb-5 animate-float animate-pulse-glow shadow-lg shadow-indigo-500/20">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-gradient">Scam Shield</h1>
          <p className="text-slate-500 mt-2 text-sm">UPI Fraud Prevention System</p>
          <p className="text-slate-400 mt-1 text-[11px] tracking-wide">
            Powered by <span className="text-emerald-600 font-medium">H.I.V.E. Intelligence</span> + <span className="text-indigo-600 font-medium">Model 2</span>
          </p>
        </div>

        {sessionExpired && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-sm text-center animate-fade-in-down">
            {sessionExpired}
          </div>
        )}

        <form onSubmit={handleLogin} className="glass rounded-2xl p-6 space-y-4 animate-fade-in-up shadow-xl shadow-gray-300/30">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Email or Phone</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <input
                type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                placeholder="name@email.com or +91..."
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                autoComplete="email"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Password</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-sm animate-fade-in">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30">
            {loading ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Logging in...</>) : 'Login'}
          </button>
        </form>

        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Demo Accounts</p>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {DEMO_CREDS.map((c, i) => (
              <button key={i} onClick={() => fillCreds(c)}
                className={`p-3.5 rounded-xl glass card-hover hover:border-indigo-500/40 transition-all text-center animate-fade-in-up delay-${(i + 1) * 100} group`}>
                <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-white font-bold text-sm mb-2 bg-gradient-to-br ${c.color} shadow-lg group-hover:scale-110 transition-transform`}>{c.label[0]}</div>
                <p className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">{c.label.split(' ')[0]}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{c.sub}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-1.5 text-slate-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-[10px] tracking-wide">Protected by AI-powered scam detection</span>
          </div>
        </div>
      </div>
    </div>
  )
}
