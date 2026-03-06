import useStore from '../store/useStore'
import Breadcrumb from './Breadcrumb'

export default function BottomBar() {
  const zoomLevel = useStore((s) => s.zoomLevel)
  const goBack = useStore((s) => s.goBack)

  const hints = {
    1: 'CLICK THE TOWER TO ENTER',
    2: 'CLICK A GARDEN TO INSPECT',
    3: 'CLICK A CREATURE FOR DETAILS',
  }

  return (
    <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between px-4 py-2 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-[#FFD93D] shadow-lg">
      <div className="flex items-center gap-3">
        {zoomLevel > 1 && (
          <button
            onClick={goBack}
            className="font-press text-[7px] text-[#4A6FA5] hover:text-[#7BC8F6] cursor-pointer"
          >
            {'<'} BACK
          </button>
        )}
        <Breadcrumb />
      </div>

      <div className="font-press text-[6px] text-gray-400 animate-pulse">
        {hints[zoomLevel]}
      </div>
    </div>
  )
}
