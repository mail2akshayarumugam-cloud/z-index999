import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const USER_ID = 'user-arjun'
const DEVICE_ID = 'dev-arjun-pixel'

const RECENT_BENEFICIARIES = [
  { name: 'PG Rent - Srinivas', upi: 'srinivas.pg@okaxis' },
  { name: 'BESCOM Electricity', upi: 'bescom.blr@oksbi' },
  { name: 'Neha (friend)', upi: 'neha.gupta92@okhdfcbank' },
]

const DEMO_SCENARIOS = [
  { label: 'Safe: Rs600 to Neha (friend)', name: 'Neha Gupta', upi: 'neha.gupta92@okhdfcbank', amount: '600', note: 'Swiggy split' },
  { label: 'Suspicious: Rs50,000 to new UPI', name: 'Unknown Person', upi: 'randomnew@ybl', amount: '50000', note: '' },
  { label: 'CRITICAL: Scammer flagged by H.I.V.E.', name: 'HDFC Investment Desk', upi: 'vikram.invest@ybl', amount: '25000', note: 'Premium FD Scheme' },
]

export default function SendMoneyPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [upi, setUpi] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function fillScenario(s) {
    setName(s.name)
    setUpi(s.upi)
    setAmount(s.amount)
    setNote(s.note)
    setError('')
  }

  async function handlePay(e) {
    e.preventDefault()
    if (!upi || !amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid UPI ID and amount')
      return
    }
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('/api/transactions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: USER_ID,
          beneficiary_upi: upi,
          amount: parseFloat(amount),
          description: note || undefined,
          device_id: DEVICE_ID,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.detail || 'Preview failed')
      }
      const data = await resp.json()
      navigate('/review', { state: { preview: data, recipientName: name, userId: USER_ID } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Send Money</h1>

      {/* Demo Scenarios */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4">
        <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wide mb-3">Demo Scenarios</p>
        <div className="space-y-2">
          {DEMO_SCENARIOS.map((s, i) => (
            <button key={i} onClick={() => fillScenario(s)} className="w-full text-left px-3 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-sm text-slate-300">
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Beneficiaries */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4">
        <p className="text-sm font-medium text-slate-300 mb-3">Recent Beneficiaries</p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {RECENT_BENEFICIARIES.map(b => (
            <button key={b.upi} onClick={() => { setName(b.name); setUpi(b.upi) }}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0f172a] border border-[#334155] hover:border-indigo-500/50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-bold">
                {b.name[0]}
              </div>
              <div className="text-left">
                <p className="text-sm text-slate-300 font-medium">{b.name}</p>
                <p className="text-[10px] text-slate-500">{b.upi}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handlePay} className="bg-[#1e293b] border border-[#334155] rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Recipient Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Enter name"
            className="w-full px-4 py-3 rounded-lg bg-[#0f172a] border border-[#334155] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">UPI ID</label>
          <input type="text" value={upi} onChange={e => setUpi(e.target.value)}
            placeholder="name@bank"
            className="w-full px-4 py-3 rounded-lg bg-[#0f172a] border border-[#334155] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Amount (Rs)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" min="1" step="0.01"
            className="w-full px-4 py-3 rounded-lg bg-[#0f172a] border border-[#334155] text-2xl font-bold text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Note (optional)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="What's this for?"
            className="w-full px-4 py-3 rounded-lg bg-[#0f172a] border border-[#334155] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {loading ? (
            <>
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Checking Security...
            </>
          ) : 'Pay'}
        </button>
        <p className="text-xs text-center text-slate-500">Payment will be verified by the Financial Risk Engine before completion</p>
      </form>
    </div>
  )
}
