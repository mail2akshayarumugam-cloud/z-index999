import { useState, useEffect, useRef, useCallback } from 'react'
import gsap from 'gsap'

const COLORS = {
  committed: '#22c55e',
  blocked: '#ef4444',
  evaluated: '#f59e0b',
  awaiting_authorization: '#f97316',
  rejected: '#dc2626',
  pending: '#64748b',
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#dc2626',
  ALLOW: '#22c55e',
  VERIFY: '#f59e0b',
  STRONG_VERIFY: '#f97316',
  HOLD: '#ef4444',
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── AnimatedCounter ──────────────────────────────────────────────────────────
export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  duration = 1.5,
  decimals = 0,
}) {
  const ref = useRef(null)
  const prevValue = useRef(0)

  useEffect(() => {
    if (ref.current == null || value == null) return
    const obj = { val: prevValue.current }
    gsap.to(obj, {
      val: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = `${prefix}${obj.val
            .toFixed(decimals)
            .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${suffix}`
        }
      },
    })
    prevValue.current = value
  }, [value, prefix, suffix, duration, decimals])

  return (
    <span ref={ref}>
      {prefix}
      {(value || 0).toFixed(decimals)}
      {suffix}
    </span>
  )
}

// ── KPICard ─────────────────────────────────────────────────────────────────
export function KPICard({
  label,
  value,
  prefix = '',
  suffix = '',
  color = '#6366f1',
  icon,
  subtext,
  delay = 0,
}) {
  const cardRef = useRef(null)

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, delay, ease: 'power3.out' },
      )
    }
  }, [delay])

  return (
    <div
      ref={cardRef}
      className="bg-white rounded-[20px] p-5 border border-gray-200/60 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 group"
      style={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          {label}
        </span>
        {icon && (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: color + '15' }}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
        <AnimatedCounter value={value} prefix={prefix} suffix={suffix} />
      </div>
      {subtext && (
        <p className="text-[11px] text-slate-400 mt-1.5">{subtext}</p>
      )}
      <div className="h-0.5 mt-3 rounded-full overflow-hidden bg-gray-50">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: '100%',
            background: `linear-gradient(90deg, ${color}10, ${color}30)`,
          }}
        />
      </div>
    </div>
  )
}

// ── StatusBreakdownChart ─────────────────────────────────────────────────────
export function StatusBreakdownChart({ data }) {
  const total =
    Object.values(data).reduce((s, v) => s + (v.count || v), 0) || 1
  const barRef = useRef(null)

  useEffect(() => {
    if (barRef.current) {
      gsap.fromTo(
        barRef.current.children,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
          transformOrigin: 'left',
        },
      )
    }
  }, [data])

  return (
    <div className="space-y-2.5" ref={barRef}>
      {Object.entries(data).map(([status, val]) => {
        const count = val.count || val
        const pct = (count / total) * 100
        return (
          <div key={status} className="group cursor-default">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500 capitalize">
                {status.replace(/_/g, ' ')}
              </span>
              <span className="text-slate-700 font-mono tabular-nums">
                {count}{' '}
                <span className="text-slate-400">({pct.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all group-hover:brightness-110"
                style={{
                  width: `${pct}%`,
                  backgroundColor: COLORS[status] || '#6366f1',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── RiskDistributionChart ────────────────────────────────────────────────────
export function RiskDistributionChart({ data }) {
  const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  const maxVal = Math.max(...levels.map((l) => data[l] || 0), 1)
  const barsRef = useRef(null)

  useEffect(() => {
    if (barsRef.current) {
      gsap.fromTo(
        barsRef.current.querySelectorAll('.risk-bar-fill'),
        { scaleY: 0 },
        {
          scaleY: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: 'back.out(1.7)',
          transformOrigin: 'bottom',
        },
      )
    }
  }, [data])

  return (
    <div ref={barsRef} className="flex items-end justify-between gap-3 h-32 px-2">
      {levels.map((level) => {
        const count = data[level] || 0
        const pct = (count / maxVal) * 100
        return (
          <div key={level} className="flex-1 flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-700 font-mono tabular-nums">
              {count}
            </span>
            <div className="w-full h-20 bg-gray-100 rounded-t-lg relative overflow-hidden">
              <div
                className="risk-bar-fill absolute bottom-0 w-full rounded-t-lg transition-colors hover:brightness-110"
                style={{
                  height: `${Math.max(pct, 4)}%`,
                  backgroundColor: COLORS[level],
                }}
              />
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: COLORS[level] }}
            >
              {level}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── DailyVolumeChart (monthly buckets) ──────────────────────────────────────
export function DailyVolumeChart({ data }) {
  if (!data || data.length === 0)
    return (
      <p className="text-slate-400 text-xs text-center py-8">
        No transaction data yet
      </p>
    )

  // Aggregate into monthly buckets
  const monthMap = {}
  for (const d of data) {
    const key = d.date ? d.date.slice(0, 7) : 'unknown' // "YYYY-MM"
    if (!monthMap[key]) monthMap[key] = { amount: 0, count: 0, key }
    monthMap[key].amount += d.amount
    monthMap[key].count += d.count
  }
  const months = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key))
  if (months.length === 0) months.push({ amount: 0, count: 0, key: '' })

  const maxAmt = Math.max(...months.map((m) => m.amount), 1)
  const barsRef = useRef(null)

  useEffect(() => {
    if (barsRef.current) {
      gsap.fromTo(
        barsRef.current.querySelectorAll('.vol-bar'),
        { scaleY: 0 },
        {
          scaleY: 1,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power3.out',
          transformOrigin: 'bottom',
        },
      )
    }
  }, [data])

  return (
    <div ref={barsRef}>
      <div className="flex items-end gap-3 h-28 px-1">
        {months.map((m, i) => {
          const pct = (m.amount / maxAmt) * 100
          const barColor =
            m.count >= 20 ? '#6366f1' : m.count >= 10 ? '#818cf8' : '#cbd5e1'
          const monthIdx = parseInt(m.key.split('-')[1], 10) - 1
          const label = MONTH_NAMES[monthIdx] || m.key.slice(5)
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center group relative"
            >
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-white text-slate-700 text-[9px] px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-mono pointer-events-none shadow-lg border border-gray-200">
                ₹{m.amount.toLocaleString('en-IN')} &middot; {m.count} txns
              </div>
              <div
                className="vol-bar w-full rounded-t-md transition-all group-hover:brightness-110"
                style={{
                  height: `${Math.max(pct, 4)}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 px-1">
        {months.map((m, i) => {
          const monthIdx = parseInt(m.key.split('-')[1], 10) - 1
          const label = MONTH_NAMES[monthIdx] || m.key.slice(5)
          return (
            <span
              key={i}
              className="text-[10px] text-slate-400 flex-1 text-center font-medium"
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── ScamTypeChart ────────────────────────────────────────────────────────────
export function ScamTypeChart({ data }) {
  if (!data || Object.keys(data).length === 0)
    return (
      <p className="text-slate-400 text-xs text-center py-4">
        No scam types detected
      </p>
    )

  const total = Object.values(data).reduce((s, v) => s + v, 0) || 1
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1])
  const colors = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
  ]

  return (
    <div className="space-y-2">
      {sorted.map(([type, count], i) => {
        const pct = (count / total) * 100
        const color = colors[i % colors.length]
        return (
          <div key={type} className="group cursor-default">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500 capitalize">
                {type.replace(/_/g, ' ')}
              </span>
              <span className="font-mono tabular-nums text-slate-700">
                {count}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full group-hover:brightness-110 transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── AlertSeverityPills ───────────────────────────────────────────────────────
export function AlertSeverityPills({ data }) {
  if (!data || Object.keys(data).length === 0) return null
  const colors = {
    critical: '#ef4444',
    high: '#f97316',
    warning: '#f59e0b',
    info: '#64748b',
  }
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(data).map(([sev, count]) => (
        <div
          key={sev}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold"
          style={{
            borderColor: (colors[sev] || '#6366f1') + '30',
            backgroundColor: (colors[sev] || '#6366f1') + '10',
            color: colors[sev] || '#6366f1',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: colors[sev] || '#6366f1' }}
          />
          {sev}: {count}
        </div>
      ))}
    </div>
  )
}

// ── useDashboardStats hook ───────────────────────────────────────────────────
export function useDashboardStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch('/api/dashboard/stats')
      if (!resp.ok) throw new Error('Failed to fetch stats')
      const data = await resp.json()
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  return { stats, loading, error, refresh: fetchStats }
}
