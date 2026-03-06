import { create } from 'zustand'

const FLOORS = [
  { id: 1, name: 'SONIC THE HEDGEHOG', security: 'low' },
  { id: 2, name: 'YAKUZA', security: 'medium' },
  { id: 3, name: 'PERSONA', security: 'high' },
  { id: 4, name: 'SHENMUE', security: 'critical' },
  { id: 5, name: 'CHAO RESORT ISLAND', security: 'critical' },
]

const DEVICES = [
  { id: 'PC-F1-R01', type: 'pc', floor: 1, name: 'Front Desk PC', trust: 95, status: 'active', pos: [0, 0, 0] },
  { id: 'PC-F1-R02', type: 'printer', floor: 1, name: 'Lobby Printer', trust: 90, status: 'active', pos: [3, 0, 0] },
  { id: 'RT-F1-R03', type: 'router', floor: 1, name: 'Lobby Router', trust: 88, status: 'active', pos: [-3, 0, 0] },

  { id: 'PC-F2-R01', type: 'pc', floor: 2, name: 'HR Workstation A', trust: 92, status: 'active', pos: [0, 0, 0] },
  { id: 'PC-F2-R02', type: 'pc', floor: 2, name: 'HR Workstation B', trust: 91, status: 'active', pos: [3, 0, 0] },
  { id: 'PR-F2-R03', type: 'printer', floor: 2, name: 'HR Printer', trust: 85, status: 'active', pos: [-3, 0, 0] },

  { id: 'PC-F3-R01', type: 'pc', floor: 3, name: 'Dev Machine Alpha', trust: 97, status: 'active', pos: [-4, 0, -2] },
  { id: 'PC-F3-R02', type: 'pc', floor: 3, name: 'Dev Machine Beta', trust: 96, status: 'active', pos: [0, 0, -2] },
  { id: 'SV-F3-R03', type: 'server', floor: 3, name: 'Build Server', trust: 99, status: 'active', pos: [4, 0, -2] },
  { id: 'RT-F3-R04', type: 'router', floor: 3, name: 'Eng Router', trust: 94, status: 'active', pos: [-4, 0, 2] },
  { id: 'PC-F3-R12', type: 'honeypot', floor: 3, name: 'Honeypot PC', trust: 50, status: 'active', pos: [4, 0, 2] },

  { id: 'PC-F4-R01', type: 'pc', floor: 4, name: 'CEO Workstation', trust: 99, status: 'active', pos: [0, 0, 0] },
  { id: 'PC-F4-R02', type: 'pc', floor: 4, name: 'CFO Workstation', trust: 98, status: 'active', pos: [3, 0, 0] },
  { id: 'PR-F4-R03', type: 'printer', floor: 4, name: 'Exec Printer', trust: 90, status: 'active', pos: [-3, 0, 0] },

  { id: 'SV-F5-R01', type: 'server', floor: 5, name: 'Main DB Server', trust: 100, status: 'active', pos: [-3, 0, 0] },
  { id: 'SV-F5-R02', type: 'server', floor: 5, name: 'Backup Server', trust: 100, status: 'active', pos: [0, 0, 0] },
  { id: 'SV-F5-R03', type: 'server', floor: 5, name: 'App Server', trust: 100, status: 'active', pos: [3, 0, 0] },
  { id: 'RT-F5-R04', type: 'router', floor: 5, name: 'Core Switch', trust: 100, status: 'active', pos: [0, 0, 3] },
]

const SECURITY_COLORS = {
  low: '#4169E1',
  medium: '#FFD700',
  high: '#E60026',
  critical: '#8B00FF',
}

function getTrustColor(trust) {
  if (trust >= 80) return '#00C851'
  if (trust >= 60) return '#FFD700'
  if (trust >= 40) return '#FF6B35'
  if (trust >= 20) return '#E60026'
  return '#888888'
}

const useStore = create((set, get) => ({
  // Zoom state
  zoomLevel: 1, // 1=world, 2=building, 3=floor
  selectedFloor: null,
  selectedDevice: null,

  // Data
  floors: FLOORS,
  devices: DEVICES,
  alerts: [],
  attackActive: false,
  attackPhase: 0,
  attackTargetFloor: null,
  attackTargetDevice: null,

  // Computed helpers
  getSecurityColor: (security) => SECURITY_COLORS[security] || '#4169E1',
  getTrustColor,
  getFloorDevices: (floorId) => get().devices.filter(d => d.floor === floorId),

  // Navigation
  zoomToBuilding: () => set({ zoomLevel: 2, selectedFloor: null, selectedDevice: null }),
  zoomToFloor: (floorId) => set({ zoomLevel: 3, selectedFloor: floorId, selectedDevice: null }),
  zoomToWorld: () => set({ zoomLevel: 1, selectedFloor: null, selectedDevice: null }),
  selectDevice: (deviceId) => set({ selectedDevice: deviceId }),
  goBack: () => {
    const { zoomLevel } = get()
    if (zoomLevel === 3) set({ zoomLevel: 2, selectedFloor: null, selectedDevice: null })
    else if (zoomLevel === 2) set({ zoomLevel: 1, selectedFloor: null, selectedDevice: null })
  },

  // Alerts
  addAlert: (alert) => set((s) => ({
    alerts: [{ ...alert, id: Date.now() + Math.random(), time: new Date() }, ...s.alerts].slice(0, 50)
  })),

  // Device updates
  updateDevice: (id, updates) => set((s) => ({
    devices: s.devices.map(d => d.id === id ? { ...d, ...updates } : d)
  })),

  // Attack demo
  setAttackActive: (active) => set({ attackActive: active }),
  setAttackPhase: (phase) => set({ attackPhase: phase }),

  runAttackDemo: () => {
    const { setAttackActive, setAttackPhase, addAlert, updateDevice, zoomToFloor, devices } = get()

    // Pick a random device that is currently active
    const activeDevices = devices.filter(d => d.status === 'active')
    const target = activeDevices[Math.floor(Math.random() * activeDevices.length)]
    if (!target) return

    const floorId = target.floor
    const deviceId = target.id
    const floorName = FLOORS.find(f => f.id === floorId)?.name || `FL.${floorId}`

    set({ attackTargetFloor: floorId, attackTargetDevice: deviceId })
    setAttackActive(true)
    setAttackPhase(1)

    const ATTACKS = [
      { title: 'SSH BRUTE FORCE', msg: 'Multiple failed SSH attempts' },
      { title: 'RDP EXPLOIT', msg: 'RDP vulnerability exploit attempt' },
      { title: 'SQL INJECTION', msg: 'Malicious SQL payload detected' },
      { title: 'PHISHING PAYLOAD', msg: 'Malicious attachment opened' },
      { title: 'ZERO-DAY EXPLOIT', msg: 'Unknown vulnerability exploited' },
    ]
    const attack = ATTACKS[Math.floor(Math.random() * ATTACKS.length)]

    // Phase 1: Initial detection (0s)
    addAlert({ severity: 'warning', title: attack.title, message: `${attack.msg} on ${floorName}`, device: deviceId })

    // Phase 2: Successful breach (2s)
    setTimeout(() => {
      setAttackPhase(2)
      zoomToFloor(floorId)
      updateDevice(deviceId, { trust: 35, status: 'compromised' })
      addAlert({ severity: 'critical', title: 'UNAUTHORIZED ACCESS', message: `Breach confirmed on ${target.name} (${deviceId})`, device: deviceId })
    }, 2000)

    // Phase 3: Lateral movement (4s)
    setTimeout(() => {
      setAttackPhase(3)
      updateDevice(deviceId, { trust: 20 })
      addAlert({ severity: 'critical', title: 'SUSPICIOUS FILE ACCESS', message: `Reading sensitive files on ${deviceId}`, device: deviceId })
      addAlert({ severity: 'warning', title: 'LATERAL MOVEMENT', message: `Port scan detected from ${deviceId}`, device: deviceId })
    }, 4000)

    // Phase 4: Exfiltration (6s)
    setTimeout(() => {
      setAttackPhase(4)
      updateDevice(deviceId, { trust: 5 })
      const size = (Math.random() * 4 + 0.5).toFixed(1)
      addAlert({ severity: 'critical', title: 'DATA EXFILTRATION', message: `Outbound transfer ${size}GB from ${deviceId}`, device: deviceId })
    }, 6000)

    // Phase 5: Quarantine (8s)
    setTimeout(() => {
      setAttackPhase(5)
      updateDevice(deviceId, { trust: 0, status: 'quarantined' })
      addAlert({ severity: 'info', title: 'DEVICE QUARANTINED', message: `${deviceId} isolated from network. Threat contained.`, device: deviceId })
    }, 8000)

    // Cleanup (10s)
    setTimeout(() => {
      setAttackActive(false)
      setAttackPhase(0)
      set({ attackTargetFloor: null, attackTargetDevice: null })
      addAlert({ severity: 'info', title: 'INCIDENT RESOLVED', message: `Threat on ${target.name} contained. System returning to normal.`, device: deviceId })
    }, 10000)
  },

  resetDemo: () => set((s) => ({
    attackActive: false,
    attackPhase: 0,
    attackTargetFloor: null,
    attackTargetDevice: null,
    devices: DEVICES.map(d => ({ ...d })),
    alerts: [],
    zoomLevel: 1,
    selectedFloor: null,
    selectedDevice: null,
  })),
}))

export default useStore
