import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import useStore from '../store/useStore'
import FloorInterior from './FloorInterior'

const FLOOR_COLORS = ['#7BC8F6', '#FFD93D', '#FF6B6B', '#9B5DE5', '#FF8FA3']

// More spacing between floors so they don't overlap
const FLOOR_SPACING = 3.5

export function getFloorY(floorId) {
  return (floorId - 1) * FLOOR_SPACING + 1.0
}

export default function FloorSlab({ floor }) {
  const zoomLevel = useStore((s) => s.zoomLevel)
  const selectedFloor = useStore((s) => s.selectedFloor)
  const zoomToFloor = useStore((s) => s.zoomToFloor)
  const attackPhase = useStore((s) => s.attackPhase)
  const attackTargetFloor = useStore((s) => s.attackTargetFloor)
  const meshRef = useRef()

  const y = getFloorY(floor.id)
  const color = FLOOR_COLORS[(floor.id - 1) % FLOOR_COLORS.length]
  const isSelected = selectedFloor === floor.id
  const isFloorView = zoomLevel === 3
  const isUnderAttack = attackTargetFloor === floor.id

  useFrame((state) => {
    if (meshRef.current && isUnderAttack && attackPhase >= 1 && attackPhase < 5) {
      const flicker = Math.sin(state.clock.elapsedTime * 10) > 0
      meshRef.current.material.emissiveIntensity = flicker ? 0.8 : 0.2
    } else if (meshRef.current) {
      meshRef.current.material.emissiveIntensity = 0.1
    }
  })

  if (isFloorView && !isSelected) return null
  if (isFloorView && isSelected) return <FloorInterior floor={floor} y={y} />

  return (
    <group position={[0, y, 0]}>
      {/* Platform base */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); zoomToFloor(floor.id) }}
        castShadow
      >
        <cylinderGeometry args={[7, 7, 0.4, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={isUnderAttack && attackPhase >= 1 ? '#E60026' : color}
          emissiveIntensity={0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Top surface - muted tone */}
      <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6.8, 16]} />
        <meshStandardMaterial color="#E8E0D4" />
      </mesh>

      {/* Edge ring */}
      <mesh position={[0, 0.2, 0]}>
        <torusGeometry args={[7, 0.06, 6, 24]} />
        <meshStandardMaterial color="#C19A6B" />
      </mesh>

      {/* Signpost in front */}
      <mesh position={[0, 0.6, 7.5]}>
        <cylinderGeometry args={[0.04, 0.04, 1.2, 4]} />
        <meshStandardMaterial color="#C19A6B" />
      </mesh>
      {/* Sign board */}
      <mesh position={[0, 1.1, 7.6]}>
        <boxGeometry args={[3, 0.6, 0.08]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        position={[0, 1.12, 7.65]}
        fontSize={0.18}
        color="#FFFFFF"
        font="/PressStart2P-Regular.ttf"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000"
      >
        {floor.name}
      </Text>

      {/* Connecting pole to floor below (except floor 1) */}
      {floor.id > 1 && (
        <mesh position={[0, -FLOOR_SPACING / 2, 0]}>
          <cylinderGeometry args={[0.08, 0.08, FLOOR_SPACING - 0.5, 6]} />
          <meshStandardMaterial color="#C19A6B" transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  )
}
