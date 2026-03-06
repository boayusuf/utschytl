import useStore from '../store/useStore'

const FLOOR_COLORS = ['#7BC8F6', '#FFD93D', '#FF6B6B', '#9B5DE5', '#FF8FA3']

export default function FloorPanel() {
  const floors = useStore((s) => s.floors)
  const devices = useStore((s) => s.devices)
  const zoomLevel = useStore((s) => s.zoomLevel)
  const selectedFloor = useStore((s) => s.selectedFloor)
  const zoomToFloor = useStore((s) => s.zoomToFloor)
  const zoomToBuilding = useStore((s) => s.zoomToBuilding)

  return (
    <div className="absolute left-2 top-16 bottom-14 z-10 w-72 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-[#FFD93D] p-4 flex flex-col gap-2 overflow-y-auto shadow-lg">
      <div className="font-press text-xs text-[#4A6FA5] mb-1">GARDENS</div>

      <div className="font-press text-[9px] text-gray-400 px-1 mb-1">
        ZOOM: LV.{zoomLevel}
      </div>

      {zoomLevel >= 2 && (
        <button
          onClick={zoomToBuilding}
          className="font-press text-[10px] px-3 py-2 bg-[#E8F4FD] rounded-lg border-2 border-[#7BC8F6] hover:bg-[#D0EBFA] text-left cursor-pointer"
        >
          {'<'} TOWER VIEW
        </button>
      )}

      {[...floors].reverse().map((floor) => {
        const floorDevices = devices.filter(d => d.floor === floor.id)
        const avgTrust = Math.round(floorDevices.reduce((s, d) => s + d.trust, 0) / floorDevices.length)
        const isSelected = selectedFloor === floor.id
        const color = FLOOR_COLORS[(floor.id - 1) % FLOOR_COLORS.length]

        return (
          <button
            key={floor.id}
            onClick={() => zoomToFloor(floor.id)}
            className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
              isSelected ? 'border-[#FFD93D] bg-yellow-50 shadow-md' : 'border-white/60 bg-white/50 hover:border-[#FFD93D]'
            }`}
          >
            <div className="font-press text-[10px] text-gray-700 leading-tight">{floor.name}</div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${avgTrust}%`, backgroundColor: color }}
                />
              </div>
              <span className="font-press text-[9px] text-gray-400">{avgTrust}%</span>
            </div>
            <div className="font-press text-[8px] text-gray-400 mt-1">
              {floorDevices.length} CREATURES
            </div>
          </button>
        )
      })}
    </div>
  )
}
