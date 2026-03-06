import useStore from '../store/useStore'

export default function TopBar() {
  const devices = useStore((s) => s.devices)
  const alerts = useStore((s) => s.alerts)
  const attackActive = useStore((s) => s.attackActive)
  const runAttackDemo = useStore((s) => s.runAttackDemo)
  const resetDemo = useStore((s) => s.resetDemo)

  const activeNodes = devices.filter(d => d.status === 'active').length
  const threats = devices.filter(d => d.status === 'compromised').length
  const blocked = devices.filter(d => d.status === 'quarantined').length
  const avgTrust = Math.round(devices.reduce((sum, d) => sum + d.trust, 0) / devices.length)

  return (
    <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between px-4 py-2 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-[#FFD93D] shadow-lg">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="text-[#0060A8] font-press text-xs tracking-wider">
          SEGA
        </div>
        <div className="text-[#FF6B6B] font-press text-xs tracking-wider">
          HQ
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <StatBox label="NODES" value={activeNodes} color="#5CBF60" />
        <StatBox label="THREATS" value={threats} color="#FF6B6B" />
        <StatBox label="BLOCKED" value={blocked} color="#9B9B9B" />
        <StatBox label="TRUST" value={`${avgTrust}%`} color={avgTrust > 70 ? '#5CBF60' : '#FFD93D'} />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={runAttackDemo}
          disabled={attackActive}
          className="font-press text-[8px] px-3 py-2 bg-[#FF6B6B] text-white rounded-xl border-2 border-[#E84040] hover:bg-[#FF8585] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-md"
        >
          {attackActive ? 'ATTACKING...' : '> DEMO ATTACK'}
        </button>
        <button
          onClick={resetDemo}
          className="font-press text-[8px] px-3 py-2 bg-[#7BC8F6] text-white rounded-xl border-2 border-[#5BADE6] hover:bg-[#95D5FF] transition-colors cursor-pointer shadow-md"
        >
          ~ RESET
        </button>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div className="flex flex-col items-center px-3 py-1 rounded-xl border-2 border-white/60 bg-white/50 min-w-[70px]">
      <span className="font-press text-[6px] text-gray-400">{label}</span>
      <span className="font-press text-sm" style={{ color }}>{value}</span>
    </div>
  )
}
