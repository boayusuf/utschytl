import { useEffect, useRef } from 'react'
import useStore from '../store/useStore'

const addAlertSelector = (s) => s.addAlert
const updateDeviceSelector = (s) => s.updateDevice

// Sanitize string to prevent XSS via WebSocket injection
function sanitizeString(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>&"']/g, (ch) => {
    const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' }
    return map[ch]
  }).slice(0, 500) // max length to prevent payload bloat
}

// Validate and sanitize incoming WebSocket payloads
function validateAlertPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  const VALID_SEVERITIES = ['info', 'warning', 'critical']
  const severity = VALID_SEVERITIES.includes(payload.severity) ? payload.severity : 'info'
  return {
    severity,
    title: sanitizeString(payload.title || ''),
    message: sanitizeString(payload.message || ''),
    device: sanitizeString(payload.device || ''),
  }
}

function validateDevicePayload(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string') return null
  const sanitized = { id: sanitizeString(payload.id) }
  if (typeof payload.trust === 'number') sanitized.trust = Math.max(0, Math.min(100, Math.round(payload.trust)))
  if (typeof payload.status === 'string') {
    const VALID_STATUSES = ['active', 'compromised', 'quarantined']
    if (VALID_STATUSES.includes(payload.status)) sanitized.status = payload.status
  }
  return sanitized
}

const MAX_MSG_SIZE = 4096

export default function useWebSocket(url = 'ws://localhost:8000/ws') {
  const wsRef = useRef(null)
  const addAlert = useStore(addAlertSelector)
  const updateDevice = useStore(updateDeviceSelector)

  useEffect(() => {
    // Only allow expected WebSocket origins
    if (!url.startsWith('ws://localhost:') && !url.startsWith('wss://')) return

    let ws
    try {
      ws = new WebSocket(url)
      wsRef.current = ws

      ws.onmessage = (event) => {
        try {
          // Reject oversized messages
          if (typeof event.data === 'string' && event.data.length > MAX_MSG_SIZE) return

          const data = JSON.parse(event.data)
          if (data.type === 'alert') {
            const validated = validateAlertPayload(data.payload)
            if (validated) addAlert(validated)
          } else if (data.type === 'device_update') {
            const validated = validateDevicePayload(data.payload)
            if (validated) updateDevice(validated.id, validated)
          }
          // Unknown message types are silently dropped
        } catch (e) {
          // ignore malformed messages
        }
      }

      ws.onerror = () => {}
      ws.onclose = () => {}
    } catch (e) {
      // backend not running — demo mode works without it
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [url, addAlert, updateDevice])

  return wsRef
}
