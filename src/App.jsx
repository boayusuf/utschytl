import { useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import World from './scene/World'
import TopBar from './hud/TopBar'
import FloorPanel from './hud/FloorPanel'
import ThreatFeed from './hud/ThreatFeed'
import DeviceDetail from './hud/DeviceDetail'
import BottomBar from './hud/BottomBar'
import LoadingScreen from './hud/LoadingScreen'
import useWebSocket from './hooks/useWebSocket'

export default function App() {
  useWebSocket()
  const [loaded, setLoaded] = useState(false)
  const handleLoadComplete = useCallback(() => setLoaded(true), [])

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#87CEEB]">
      {!loaded && <LoadingScreen onComplete={handleLoadComplete} />}

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [30, 22, 30], fov: 45 }}
        shadows
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor('#87CEEB')
        }}
      >
        <World />
      </Canvas>

      {/* 2D HUD Overlay */}
      <TopBar />
      <FloorPanel />
      <ThreatFeed />
      <DeviceDetail />
      <BottomBar />
    </div>
  )
}
