import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import useStore from '../store/useStore'

export default function AttackBeam() {
  const attackActive = useStore((s) => s.attackActive)
  const attackPhase = useStore((s) => s.attackPhase)
  const beamRef = useRef()
  const particlesRef = useRef()

  const targetFloorY = (3 - 1) * 3.5 + 1.0
  const targetPos = useMemo(() => new THREE.Vector3(4, targetFloorY, 2), [targetFloorY])
  const originPos = useMemo(() => new THREE.Vector3(25, 20, 25), [])

  const particleCount = 20
  const particlePositions = useMemo(() => new Float32Array(particleCount * 3), [])

  useFrame((state) => {
    if (!beamRef.current) return

    if (attackPhase >= 2 && attackPhase < 5) {
      beamRef.current.visible = true
      const mat = beamRef.current.material
      mat.opacity = 0.4 + Math.sin(state.clock.elapsedTime * 6) * 0.3

      if (particlesRef.current) {
        const positions = particlesRef.current.geometry.attributes.position
        for (let i = 0; i < particleCount; i++) {
          const t = ((state.clock.elapsedTime * 0.5 + i / particleCount) % 1)
          positions.array[i * 3] = originPos.x + (targetPos.x - originPos.x) * t
          positions.array[i * 3 + 1] = originPos.y + (targetPos.y - originPos.y) * t
          positions.array[i * 3 + 2] = originPos.z + (targetPos.z - originPos.z) * t
        }
        positions.needsUpdate = true
      }
    } else {
      beamRef.current.visible = false
    }
  })

  if (!attackActive) return null

  const direction = new THREE.Vector3().subVectors(targetPos, originPos)
  const midpoint = new THREE.Vector3().addVectors(originPos, targetPos).multiplyScalar(0.5)
  const length = direction.length()

  const axis = new THREE.Vector3(0, 1, 0)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction.clone().normalize())
  const euler = new THREE.Euler().setFromQuaternion(quaternion)

  return (
    <group>
      <mesh ref={beamRef} position={midpoint} rotation={euler}>
        <cylinderGeometry args={[0.08, 0.08, length, 6]} />
        <meshBasicMaterial color="#E60026" transparent opacity={0.5} />
      </mesh>

      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={particlePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#FF4444" size={0.25} transparent opacity={0.8} sizeAttenuation />
      </points>
    </group>
  )
}
