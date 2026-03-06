import useStore from '../store/useStore'

const FLOOR_COLORS = ['#7BC8F6', '#FFD93D', '#FF6B6B', '#9B5DE5', '#FF8FA3']

const STATUS_DOT = {
  active: '#5CBF60',
  compromised: '#FF6B6B',
  quarantined: '#999',
}

export default function Minimap() {
  const floors = useStore((s) => s.floors)
  const devices = useStore((s) => s.devices)
  const zoomLevel = useStore((s) => s.zoomLevel)
  const selectedFloor = useStore((s) => s.selectedFloor)
  const zoomToFloor = useStore((s) => s.zoomToFloor)
  const zoomToBuilding = useStore((s) => s.zoomToBuilding)
  const zoomToWorld = useStore((s) => s.zoomToWorld)

  return (
    <div className="absolute bottom-16 right-4 z-20 w-44 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-[#4A6FA5] shadow-lg p-3">
      <div className="font-press text-[8px] text-[#4A6FA5] mb-2 text-center">MINIMAP</div>

      {/* Tower representation */}
      <div className="flex flex-col items-center gap-1">
        {/* Roof */}
        <div
          className="w-0 h-0 cursor-pointer"
          onClick={zoomToWorld}
          style={{
            borderLeft: '28px solid transparent',
            borderRight: '28px solid transparent',
            borderBottom: '14px solid #E86464',
          }}
        />

        {/* Floors stacked */}
        {[...floors].reverse().map((floor) => {
          const floorDevices = devices.filter(d => d.floor === floor.id)
          const color = FLOOR_COLORS[(floor.id - 1) % FLOOR_COLORS.length]
          const isSelected = selectedFloor === floor.id
          const hasCompromised = floorDevices.some(d => d.status === 'compromised')

          return (
            <div
              key={floor.id}
              onClick={() => zoomToFloor(floor.id)}
              className={`w-full rounded-md cursor-pointer transition-all relative ${
                isSelected ? 'ring-2 ring-[#FFD93D] scale-105' : 'hover:brightness-110'
              }`}
              style={{
                backgroundColor: color,
                opacity: isSelected ? 1 : 0.7,
                height: '22px',
              }}
            >
              {/* Floor label */}
              <div className="absolute inset-0 flex items-center justify-between px-2">
                <span className="font-press text-[5px] text-white drop-shadow-sm truncate max-w-[70px]">
                  F{floor.id}
                </span>
                {/* Device status dots */}
                <div className="flex gap-0.5">
                  {floorDevices.map((d) => (
                    <div
                      key={d.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: STATUS_DOT[d.status] || STATUS_DOT.active }}
                    />
                  ))}
                </div>
              </div>

              {/* Alert flash */}
              {hasCompromised && (
                <div className="absolute inset-0 rounded-md border-2 border-[#FF6B6B] animate-pulse" />
              )}
            </div>
          )
        })}

        {/* Foundation */}
        <div
          className="w-full h-2 rounded-b-md bg-[#D4C4A8] cursor-pointer"
          onClick={zoomToBuilding}
        />
      </div>

      {/* Zoom indicator */}
      <div className="mt-2 flex items-center justify-center gap-1">
        {[1, 2, 3].map((lv) => (
          <div
            key={lv}
            className={`w-2 h-2 rounded-full transition-all ${
              zoomLevel >= lv ? 'bg-[#4A6FA5]' : 'bg-gray-200'
            }`}
          />
        ))}
        <span className="font-press text-[6px] text-gray-400 ml-1">
          {zoomLevel === 1 ? 'WORLD' : zoomLevel === 2 ? 'TOWER' : 'FLOOR'}
        </span>
      </div>
    </div>
  )
}
