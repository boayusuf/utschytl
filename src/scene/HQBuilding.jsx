import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import useStore from '../store/useStore'
import FloorSlab from './FloorSlab'

function FloatingLabel({ text, position }) {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.5) * 0.3
    }
  })
  return (
    <Text
      ref={ref}
      position={position}
      fontSize={0.5}
      color="#FFFFFF"
      font="/PressStart2P-Regular.ttf"
      anchorX="center"
      anchorY="bottom"
      outlineWidth={0.05}
      outlineColor="#4A6FA5"
    >
      {text}
    </Text>
  )
}

function TowerRoof({ y }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 1.2, 0]}>
        <coneGeometry args={[4.5, 3, 8]} />
        <meshStandardMaterial color="#E86464" />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 3.8, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.6, 4]} />
        <meshStandardMaterial color="#8B6914" />
      </mesh>
      <mesh position={[0.35, 4.2, 0]}>
        <planeGeometry args={[0.7, 0.4]} />
        <meshStandardMaterial color="#FF6B6B" side={2} />
      </mesh>
    </group>
  )
}

// Base Y offset so floor 1 sits above ground
const BASE_Y = 1.0

export default function HQBuilding() {
  const zoomLevel = useStore((s) => s.zoomLevel)
  const zoomToBuilding = useStore((s) => s.zoomToBuilding)
  const floors = useStore((s) => s.floors)
  const attackActive = useStore((s) => s.attackActive)
  const attackPhase = useStore((s) => s.attackPhase)

  const buildingHeight = floors.length * 2.5 + BASE_Y
  const sirenRef = useRef()

  useFrame((state) => {
    if (sirenRef.current && attackActive && attackPhase >= 4) {
      sirenRef.current.material.emissiveIntensity = Math.sin(state.clock.elapsedTime * 8) * 2 + 2
    }
  })

  return (
    <group>
      {zoomLevel === 1 && (
        <group onClick={(e) => { e.stopPropagation(); zoomToBuilding() }}>
          {/* Foundation / base platform */}
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[5.5, 6, 0.5, 12]} />
            <meshStandardMaterial color="#D4C4A8" />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[5, 5.5, 0.1, 12]} />
            <meshStandardMaterial color="#C19A6B" />
          </mesh>

          {/* Tower body */}
          {floors.map((_, fi) => {
            const y = fi * 2.5 + BASE_Y + 1.2
            const radius = 4 - fi * 0.15
            return (
              <group key={fi}>
                <mesh position={[0, y, 0]}>
                  <cylinderGeometry args={[radius - 0.1, radius, 2.2, 12]} />
                  <meshStandardMaterial
                    color={fi % 2 === 0 ? '#FFF8E7' : '#FFE8D6'}
                  />
                </mesh>
                <mesh position={[0, y + 1.1, 0]}>
                  <torusGeometry args={[radius, 0.08, 6, 16]} />
                  <meshStandardMaterial color="#C19A6B" />
                </mesh>
                {[0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6].map((angle, wi) => (
                  <mesh
                    key={wi}
                    position={[
                      Math.cos(angle) * (radius + 0.01),
                      y,
                      Math.sin(angle) * (radius + 0.01),
                    ]}
                    rotation={[0, -angle + Math.PI / 2, 0]}
                  >
                    <circleGeometry args={[0.35, 12]} />
                    <meshStandardMaterial
                      color="#7BC8F6"
                      emissive="#7BC8F6"
                      emissiveIntensity={0.3}
                    />
                  </mesh>
                ))}
              </group>
            )
          })}

          <TowerRoof y={buildingHeight + 0.5} />

          <mesh ref={sirenRef} position={[2, buildingHeight + 1.5, 2]}>
            <sphereGeometry args={[0.3, 12, 12]} />
            <meshStandardMaterial
              color={attackActive ? '#E60026' : '#00E676'}
              emissive={attackActive ? '#E60026' : '#00E676'}
              emissiveIntensity={attackActive ? 2 : 0.5}
            />
          </mesh>

          <FloatingLabel text="SEGA HQ" position={[0, buildingHeight + 5, 0]} />
        </group>
      )}

      {/* Exploded floor view */}
      {zoomLevel >= 2 && (
        <group>
          {floors.map((floor) => (
            <FloorSlab key={floor.id} floor={floor} />
          ))}
        </group>
      )}
    </group>
  )
}
