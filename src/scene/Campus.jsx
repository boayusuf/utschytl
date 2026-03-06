import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

function CuteTree({ position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 0.8, 8]} />
        <meshStandardMaterial color="#8B5E3C" />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.7, 12, 12]} />
        <meshStandardMaterial color="#5CBF60" />
      </mesh>
      <mesh position={[0.3, 1.5, 0.2]}>
        <sphereGeometry args={[0.45, 10, 10]} />
        <meshStandardMaterial color="#6FD873" />
      </mesh>
    </group>
  )
}

function Flower({ position, color = '#FF69B4' }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 4]} />
        <meshStandardMaterial color="#5D8C3E" />
      </mesh>
      {[0, 1.25, 2.5, 3.75, 5].map((rot, i) => (
        <mesh key={i} position={[Math.cos(rot) * 0.08, 0.32, Math.sin(rot) * 0.08]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#FFD700" />
      </mesh>
    </group>
  )
}

function Pond({ position, radius = 2 }) {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      ref.current.material.opacity = 0.55 + Math.sin(state.clock.elapsedTime * 1.5) * 0.08
    }
  })
  return (
    <group position={position}>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[radius, radius + 0.3, 0.2, 24]} />
        <meshStandardMaterial color="#7BB3D4" />
      </mesh>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <circleGeometry args={[radius, 24]} />
        <meshStandardMaterial color="#5BC0EB" transparent opacity={0.6} />
      </mesh>
      {[0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * (radius + 0.15), 0.05, Math.sin(a) * (radius + 0.15)]}>
          <sphereGeometry args={[0.15, 6, 6]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#C8C8C8' : '#E0D6B8'} />
        </mesh>
      ))}
    </group>
  )
}

function StonePath({ from, to, width = 0.8 }) {
  const dx = to[0] - from[0]
  const dz = to[2] - from[2]
  const len = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dx, dz)
  const cx = (from[0] + to[0]) / 2
  const cz = (from[2] + to[2]) / 2
  return (
    <mesh rotation={[-Math.PI / 2, 0, -angle]} position={[cx, 0.02, cz]}>
      <planeGeometry args={[width, len]} />
      <meshStandardMaterial color="#D4C4A8" />
    </mesh>
  )
}

function Rock({ position, scale = 1 }) {
  return (
    <mesh position={position} scale={scale}>
      <dodecahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial color="#9B9B8A" flatShading />
    </mesh>
  )
}

export default function Campus() {
  const treePositions = [
    [-14, 0, -10], [-11, 0, -13],
    [13, 0, -9], [15, 0, -5],
    [-13, 0, 9], [-10, 0, 13],
    [13, 0, 9], [10, 0, 13],
    [-9, 0, 15], [9, 0, 15],
  ]

  const flowerColors = ['#FF69B4', '#FF6B6B', '#FFD93D', '#9B5DE5', '#F9844A']

  return (
    <group>
      {/* Water / ocean base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <circleGeometry args={[55, 32]} />
        <meshStandardMaterial color="#5BC0EB" />
      </mesh>

      {/* Sandy beach ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[24, 32]} />
        <meshStandardMaterial color="#E8D5B7" />
      </mesh>

      {/* Main ground - muted green/tan mix */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[20, 32]} />
        <meshStandardMaterial color="#A8C090" />
      </mesh>

      {/* Center area - slightly lighter */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[10, 24]} />
        <meshStandardMaterial color="#B8CCA0" />
      </mesh>

      {/* Trees - fewer, only on edges */}
      {treePositions.map((pos, i) => (
        <CuteTree key={i} position={pos} scale={0.7 + Math.sin(i * 2.3) * 0.25} />
      ))}

      {/* Stone paths */}
      <StonePath from={[0, 0, 6]} to={[0, 0, 16]} />
      <StonePath from={[6, 0, 0]} to={[16, 0, 0]} />
      <StonePath from={[-6, 0, 0]} to={[-16, 0, 0]} />
      <StonePath from={[0, 0, -6]} to={[0, 0, -16]} />

      {/* Scattered flowers - just a few accents */}
      {[
        [-6, 0, 10], [-5, 0, 11],
        [8, 0, -7], [7, 0, -8],
        [-10, 0, -3],
        [5, 0, 7],
      ].map((pos, i) => (
        <Flower key={i} position={pos} color={flowerColors[i % flowerColors.length]} />
      ))}

      {/* Rock clusters */}
      <Rock position={[-8, 0.2, -8]} scale={1.2} />
      <Rock position={[-7.5, 0.15, -7]} scale={0.7} />
      <Rock position={[10, 0.2, 6]} scale={0.9} />
      <Rock position={[16, 0.3, -10]} scale={1.5} />

      {/* One pond */}
      <Pond position={[13, 0, -13]} radius={2} />
    </group>
  )
}
