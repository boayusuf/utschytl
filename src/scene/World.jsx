import { Suspense } from 'react'
import Campus from './Campus'
import HQBuilding from './HQBuilding'
import AttackBeam from './AttackBeam'
import CameraController from './CameraController'

export default function World() {
  return (
    <Suspense fallback={null}>
      {/* Bright Sega-style lighting */}
      <ambientLight intensity={0.7} color="#FFF8E7" />
      <directionalLight
        position={[15, 25, 10]}
        intensity={1.4}
        castShadow
        color="#FFF5E0"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <directionalLight position={[-10, 15, -10]} intensity={0.4} color="#B3D9FF" />

      {/* Hemisphere light - sky/ground tint */}
      <hemisphereLight args={['#87CEEB', '#D4C4A8', 0.3]} />

      {/* Fog for soft edges */}
      <fog attach="fog" args={['#87CEEB', 35, 60]} />

      <Campus />
      <HQBuilding />
      <AttackBeam />
      <CameraController />
    </Suspense>
  )
}
