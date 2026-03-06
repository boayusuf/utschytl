import { useEffect, useRef } from 'react'
import useStore from '../store/useStore'

const SEVERITY_COLORS = {
  info: { bg: '#E8F4FD', border: '#7BC8F6', text: '#4A6FA5' },
  warning: { bg: '#FFF8E1', border: '#FFD93D', text: '#B8860B' },
  critical: { bg: '#FFE8E8', border: '#FF6B6B', text: '#E84040' },
}

export default function ThreatFeed() {
  const alerts = useStore((s) => s.alerts)
  const feedRef = useRef()

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [alerts.length])

  return (
    <div className="absolute right-2 top-16 bottom-14 z-10 w-80 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-[#FF6B6B] flex flex-col shadow-lg overflow-hidden">
      <div className="font-press text-xs text-[#FF6B6B] p-4 border-b-2 border-gray-100">
        THREAT FEED
      </div>

      <div ref={feedRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {alerts.length === 0 && (
          <div className="font-press text-[10px] text-gray-300 text-center py-8">
            ALL CLEAR ~
          </div>
        )}
        {alerts.map((alert) => {
          const colors = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info
          const timeStr = alert.time ? new Date(alert.time).toLocaleTimeString() : ''
          return (
            <div
              key={alert.id}
              className="p-3 rounded-lg border-l-4 animate-slideIn"
              style={{
                backgroundColor: colors.bg,
                borderLeftColor: colors.border,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-press text-[9px] uppercase" style={{ color: colors.text }}>
                  {alert.severity}
                </span>
                <span className="font-press text-[8px] text-gray-300">{timeStr}</span>
              </div>
              <div className="font-press text-[10px] mt-1" style={{ color: colors.text }}>
                {alert.title}
              </div>
              <div className="font-press text-[8px] text-gray-500 mt-1">
                {alert.message}
              </div>
              {alert.device && (
                <div className="font-press text-[8px] text-gray-300 mt-1">
                  DEVICE: {alert.device}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
