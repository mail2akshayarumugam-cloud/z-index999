import { useRef, useEffect } from 'react'
import gsap from 'gsap'

export default function CreditCard({ name, cardNumber, expiry, network, upi }) {
  const cardRef = useRef(null)
  const sheenRef = useRef(null)

  // 3D tilt on hover
  useEffect(() => {
    if (!cardRef.current) return
    const card = cardRef.current

    const handleMove = (e) => {
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const rotateX = ((y - centerY) / centerY) * -8
      const rotateY = ((x - centerX) / centerX) * 8

      gsap.to(card, {
        rotateX,
        rotateY,
        scale: 1.02,
        duration: 0.15,
        ease: 'power2.out',
        transformPerspective: 800,
      })

      if (sheenRef.current) {
        sheenRef.current.style.opacity = '1'
        sheenRef.current.style.background = `radial-gradient(circle at ${
          (x / rect.width) * 100
        }% ${(y / rect.height) * 100}%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)`
      }
    }

    const handleLeave = () => {
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        scale: 1,
        duration: 0.4,
        ease: 'power3.out',
      })
      if (sheenRef.current) sheenRef.current.style.opacity = '0'
    }

    card.addEventListener('mousemove', handleMove)
    card.addEventListener('mouseleave', handleLeave)
    return () => {
      card.removeEventListener('mousemove', handleMove)
      card.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  // Entrance animation
  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { y: 30, opacity: 0, rotateY: -15 },
        { y: 0, opacity: 1, rotateY: 0, duration: 0.8, ease: 'power3.out', delay: 0.2 },
      )
    }
  }, [])

  const masked = cardNumber || '•••• •••• •••• ••••'
  const displayNetwork = network || 'VISA'

  return (
    <div style={{ perspective: 1000 }}>
      <div
        ref={cardRef}
        className="relative w-full rounded-2xl p-5 text-white shadow-2xl overflow-hidden flex flex-col justify-between select-none cursor-pointer"
        style={{
          aspectRatio: '1.586/1',
          background:
            'linear-gradient(135deg, #1a1a2e 0%, #16213e 35%, #0f3460 70%, #1a1a2e 100%)',
          transformStyle: 'preserve3d',
          opacity: 0,
          border: '1px solid rgba(99, 102, 241, 0.15)',
        }}
      >
        {/* Sheen overlay */}
        <div
          ref={sheenRef}
          className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300 rounded-2xl z-10"
        />

        {/* Background gradient orbs */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

        {/* Decorative accent lines */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 320 200"
        >
          <path
            d="M 50 45 C 160 45, 250 120, 320 200"
            stroke="url(#cardGrad1)"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
          <path
            d="M -10 130 C 100 110, 200 150, 330 80"
            stroke="url(#cardGrad2)"
            strokeLinecap="round"
            strokeWidth="1"
          />
          <defs>
            <linearGradient
              id="cardGrad1"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient
              id="cardGrad2"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        </svg>

        {/* Top row: Brand + Network */}
        <div className="flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <span className="font-extrabold text-[11px] tracking-widest uppercase text-white/80">
              SCAM SHIELD
            </span>
          </div>
          <span className="font-black text-base tracking-tight text-white/90 italic">
            {displayNetwork}
          </span>
        </div>

        {/* EMV Chip + Contactless */}
        <div className="flex items-center justify-between z-20 my-auto">
          <div
            className="w-10 h-7 rounded-md p-0.5 border border-amber-400/30 shadow-inner flex flex-col justify-around"
            style={{
              background:
                'linear-gradient(135deg, #fbbf24 0%, #d97706 50%, #b45309 100%)',
            }}
          >
            <div className="h-[1px] bg-amber-800/40 w-full" />
            <div className="h-[1px] bg-amber-800/40 w-full" />
            <div className="h-[1px] bg-amber-800/40 w-full" />
          </div>
          <svg
            className="w-5 h-5 text-indigo-300/50"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M8.5 16.5a5 5 0 010-9" />
            <path d="M12 19a8.5 8.5 0 000-14" />
            <path d="M15.5 21.5a12 12 0 000-19" />
          </svg>
        </div>

        {/* Bottom: Cardholder + Number + Expiry */}
        <div className="z-20 mt-1">
          <p className="font-mono text-[15px] tracking-[0.22em] text-white/95 font-bold drop-shadow-sm">
            {masked}
          </p>
          <div className="flex items-center justify-between mt-2.5">
            <p className="font-mono text-[11px] text-slate-300/80 font-medium uppercase tracking-wider">
              {name || 'Card Holder'}
            </p>
            <div className="text-right">
              <p className="text-[8px] text-slate-400/60 uppercase tracking-widest">
                Expires
              </p>
              <p className="font-mono text-[12px] text-slate-200/90 font-semibold">
                {expiry || 'MM/YY'}
              </p>
            </div>
          </div>
          {upi && (
            <p className="font-mono text-[9px] text-cyan-400/50 mt-1.5">
              {upi}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
