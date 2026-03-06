import useStore from '../store/useStore'

const TYPE_LABELS = {
  pc: 'CHAO',
  server: 'CRYSTAL',
  router: 'STAR',
  printer: 'CHEST',
  honeypot: 'HONEYPOT',
}

const STATUS_COLORS = {
  active: { bg: '#E8FFE8', text: '#5CBF60', label: 'HAPPY' },
  compromised: { bg: '#FFE8E8', text: '#FF6B6B', label: 'IN DANGER' },
  quarantined: { bg: '#F0F0F0', text: '#999', label: 'BUBBLED' },
}

export default function DeviceDetail() {
  const selectedDevice = useStore((s) => s.selectedDevice)
  const devices = useStore((s) => s.devices)
  const alerts = useStore((s) => s.alerts)
  const selectDevice = useStore((s) => s.selectDevice)
  const updateDevice = useStore((s) => s.updateDevice)
  const addAlert = useStore((s) => s.addAlert)
  const getTrustColor = useStore((s) => s.getTrustColor)
  const floors = useStore((s) => s.floors)

  if (!selectedDevice) return null

  const device = devices.find(d => d.id === selectedDevice)
  if (!device) return null

  const status = STATUS_COLORS[device.status] || STATUS_COLORS.active
  const floor = floors.find(f => f.id === device.floor)
  const deviceAlerts = alerts.filter(a => a.device === device.id).slice(0, 5)
  const trustColor = getTrustColor(device.trust)

  const handleIsolate = () => {
    updateDevice(device.id, { status: 'quarantined', trust: 0 })
    addAlert({
      severity: 'info',
      title: 'MANUAL BUBBLE',
      message: `${device.id} placed in protective bubble`,
      device: device.id,
    })
  }

  const handleInvestigate = () => {
    addAlert({
      severity: 'info',
      title: 'SCAN STARTED',
      message: `Deep scan initiated on ${device.id}`,
      device: device.id,
    })
  }

  return (
    <div className="absolute right-80 top-16 z-20 w-80 bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-[#4A6FA5] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#4A6FA5] text-white px-4 py-3 flex items-center justify-between rounded-t-xl">
        <span className="font-press text-xs">{device.id}</span>
        <button
          onClick={() => selectDevice(null)}
          className="font-press text-xs hover:text-[#FFD93D] cursor-pointer"
        >
          X
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div>
          <div className="font-press text-[9px] text-gray-400">NAME</div>
          <div className="font-press text-[12px] text-gray-700 mt-1">{device.name}</div>
        </div>

        <div className="flex gap-6">
          <div>
            <div className="font-press text-[9px] text-gray-400">TYPE</div>
            <div className="font-press text-[11px] text-gray-700 mt-1">{TYPE_LABELS[device.type]}</div>
          </div>
          <div>
            <div className="font-press text-[9px] text-gray-400">GARDEN</div>
            <div className="font-press text-[11px] text-gray-700 mt-1">{floor?.name}</div>
          </div>
        </div>

        {/* Trust score */}
        <div>
          <div className="font-press text-[9px] text-gray-400">TRUST</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${device.trust}%`, backgroundColor: trustColor }}
              />
            </div>
            <span className="font-press text-[12px] font-bold" style={{ color: trustColor }}>
              {device.trust}%
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div>
          <div className="font-press text-[9px] text-gray-400">STATUS</div>
          <span
            className="inline-block font-press text-[10px] px-3 py-1.5 mt-1 rounded-lg"
            style={{ backgroundColor: status.bg, color: status.text }}
          >
            {status.label}
          </span>
        </div>

        {/* Recent events */}
        {deviceAlerts.length > 0 && (
          <div>
            <div className="font-press text-[9px] text-gray-400 mb-1">EVENTS</div>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {deviceAlerts.map((a) => (
                <div key={a.id} className="font-press text-[8px] text-gray-500 border-l-3 border-[#FFD93D] pl-2 py-0.5 rounded-sm">
                  {a.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mt-1">
          <button
            onClick={handleIsolate}
            disabled={device.status === 'quarantined'}
            className="flex-1 font-press text-[9px] px-3 py-2.5 bg-[#FF6B6B] text-white rounded-xl border-2 border-[#E84040] hover:bg-[#FF8585] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
          >
            BUBBLE
          </button>
          <button
            onClick={handleInvestigate}
            className="flex-1 font-press text-[9px] px-3 py-2.5 bg-[#7BC8F6] text-white rounded-xl border-2 border-[#5BADE6] hover:bg-[#95D5FF] cursor-pointer shadow-md"
          >
            SCAN
          </button>
        </div>
      </div>
    </div>
  )
}
