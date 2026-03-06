import { useState, useEffect } from 'react'

export default function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState(0)
  const [visible, setVisible] = useState(true)

  const phases = [
    'INITIALIZING SYSTEMS...',
    'LOADING FLOOR DATA...',
    'SCANNING NETWORK...',
    'CONNECTING DEVICES...',
    'READY',
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + 2 + Math.random() * 3
        if (next >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            setVisible(false)
            setTimeout(onComplete, 500)
          }, 400)
          return 100
        }
        return next
      })
    }, 60)
    return () => clearInterval(interval)
  }, [onComplete])

  useEffect(() => {
    if (progress < 20) setPhase(0)
    else if (progress < 45) setPhase(1)
    else if (progress < 65) setPhase(2)
    else if (progress < 85) setPhase(3)
    else setPhase(4)
  }, [progress])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0060A8] transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* SEGA logo */}
      <div className="mb-8">
        <div className="font-press text-5xl text-white tracking-[0.3em] drop-shadow-lg">
          SEGA
        </div>
        <div className="font-press text-lg text-[#FFD93D] tracking-[0.5em] text-center mt-2">
          HQ
        </div>
      </div>

      {/* Sonic-style ring spinner */}
      <div className="relative w-16 h-16 mb-8">
        <div
          className="absolute inset-0 border-4 border-[#FFD700] rounded-full"
          style={{
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div
          className="absolute inset-2 border-4 border-[#FFD93D] rounded-full"
          style={{
            borderBottomColor: 'transparent',
            animation: 'spin 1.2s linear infinite reverse',
          }}
        />
      </div>

      {/* Progress bar */}
      <div className="w-80 mb-4">
        <div className="h-4 bg-[#003D6B] rounded-full overflow-hidden border-2 border-[#FFD700]/30">
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: 'linear-gradient(90deg, #FFD700, #FFD93D, #FFD700)',
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="font-press text-[10px] text-[#7BC8F6]">
            {phases[phase]}
          </span>
          <span className="font-press text-[10px] text-[#FFD93D]">
            {Math.min(Math.round(progress), 100)}%
          </span>
        </div>
      </div>

      {/* Subtitle */}
      <div className="font-press text-[9px] text-[#7BC8F6]/60 mt-8">
        CYBERSECURITY VISUALIZATION SYSTEM
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
