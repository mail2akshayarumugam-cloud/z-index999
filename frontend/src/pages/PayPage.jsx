import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser } from '../user'

export default function PayPage() {
  const user = getUser()
  const navigate = useNavigate()
  const [upi, setUpi] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePay(e) {
    e.preventDefault()
    if (!upi || !amount || parseFloat(amount) <= 0) {
      setError('Enter a valid UPI ID and amount')
      return
    }
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('/api/transactions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          beneficiary_upi: upi,
          amount: parseFloat(amount),
          description: note || undefined,
          device_id: user.deviceId,
        }),
      })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.detail || 'Transaction failed')
      }
      const data = await resp.json()
      navigate('/review', { state: { preview: data, userId: user.id, deviceId: user.deviceId } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-grid flex flex-col">
      {/* Header */}
      <div className="h-14 glass flex items-center px-5 gap-3 flex-shrink-0 animate-fade-in-down">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center transition-all"
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-slate-200">Send Money</span>
        <div className="flex-1" />
        <span className="text-[10px] bg-indigo-500/15 text-indigo-400 px-3 py-1 rounded-full font-medium border border-indigo-500/20">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5 animate-pulse" />
          Model 2 Pre-Check
        </span>
      </div>

      <div className="flex-1 flex items-start justify-center pt-8 px-4">
        <form onSubmit={handlePay} className="w-full max-w-md space-y-5 animate-fade-in-up">
          {/* UPI or Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Pay to
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <input
                type="text"
                value={upi}
                onChange={e => setUpi(e.target.value)}
                placeholder="UPI ID or Mobile Number"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#0f172a] border border-[#334155] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                required
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5 ml-1">e.g. name@bank or 9845012345</p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500">
                ₹
              </span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                min="1"
                step="0.01"
                className="w-full pl-11 pr-4 py-4 rounded-xl bg-[#0f172a] border border-[#334155] text-3xl font-bold text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all tabular-nums font-mono"
                required
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Note <span className="text-slate-600 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="What's this for?"
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0f172a] border border-[#334155] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2 animate-fade-in">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running Security Check...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Pay Securely
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-600 pt-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Verified by Model 2 against 30 risk signals + H.I.V.E. intelligence</span>
          </div>
        </form>
      </div>
    </div>
  )
}
