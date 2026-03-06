import useStore from '../store/useStore'

export default function Breadcrumb() {
  const zoomLevel = useStore((s) => s.zoomLevel)
  const selectedFloor = useStore((s) => s.selectedFloor)
  const selectedDevice = useStore((s) => s.selectedDevice)
  const floors = useStore((s) => s.floors)
  const zoomToWorld = useStore((s) => s.zoomToWorld)
  const zoomToBuilding = useStore((s) => s.zoomToBuilding)

  const floor = floors.find(f => f.id === selectedFloor)
  const parts = ['WORLD']
  if (zoomLevel >= 2) parts.push('TOWER')
  if (zoomLevel >= 3 && floor) parts.push(floor.name)
  if (selectedDevice) parts.push(selectedDevice)

  const handleClick = (index) => {
    if (index === 0) zoomToWorld()
    else if (index === 1) zoomToBuilding()
  }

  return (
    <div className="flex items-center gap-1">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="font-press text-[6px] text-gray-300">{'>'}</span>}
          <button
            onClick={() => handleClick(i)}
            className={`font-press text-[7px] ${
              i < parts.length - 1
                ? 'text-[#4A6FA5] hover:text-[#7BC8F6] cursor-pointer'
                : 'text-gray-500 cursor-default'
            }`}
          >
            {part}
          </button>
        </span>
      ))}
    </div>
  )
}
