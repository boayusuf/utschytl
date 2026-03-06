import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import useStore from '../store/useStore'

// Chao-style egg/creature for PCs
function ChaoPC({ color }) {
  return (
    <group>
      {/* Body - egg shape */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.28, 10, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.08, 0.68, 0.16]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[-0.08, 0.68, 0.16]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Blush marks */}
      <mesh position={[0.15, 0.62, 0.14]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color="#FF9999" transparent opacity={0.6} />
      </mesh>
      <mesh position={[-0.15, 0.62, 0.14]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color="#FF9999" transparent opacity={0.6} />
      </mesh>
      {/* Head orb (like Chao) */}
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#7BC8F6" emissive="#7BC8F6" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

// Server = big crystal
function CrystalServer({ color }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} rotation={[0, 0.4, 0]}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color={color} transparent opacity={0.85} />
      </mesh>
      {/* Inner glow */}
      <mesh position={[0, 0.5, 0]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#FFFFFF" emissive={color} emissiveIntensity={1.5} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 0.16, 6]} />
        <meshStandardMaterial color="#B8A88A" />
      </mesh>
    </group>
  )
}

// Router = spinning star
function StarRouter({ color }) {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.8
  })
  return (
    <group ref={ref}>
      <mesh position={[0, 0.35, 0]}>
        <dodecahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} flatShading />
      </mesh>
      {/* Ring */}
      <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.04, 6, 16]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

// Printer = treasure chest
function ChestPrinter({ color }) {
  return (
    <group>
      {/* Box */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.45, 0.3, 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Lid */}
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.48, 0.08, 0.33]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Lock */}
      <mesh position={[0, 0.3, 0.16]}>
        <boxGeometry args={[0.08, 0.1, 0.02]} />
        <meshStandardMaterial color="#FFD700" />
      </mesh>
    </group>
  )
}

// Honeypot = golden pot with honey drip
function HoneypotJar() {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = 0.9 + Math.sin(state.clock.elapsedTime * 2) * 0.08
      ref.current.rotation.y = state.clock.elapsedTime * 0.5
    }
  })
  return (
    <group ref={ref} position={[0, 0.9, 0]}>
      <mesh>
        <cylinderGeometry args={[0.14, 0.18, 0.3, 8]} />
        <meshStandardMaterial color="#FFD700" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.16, 0.14, 0.08, 8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Honey drip */}
      <mesh position={[0.1, -0.05, 0.12]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#DAA520" />
      </mesh>
    </group>
  )
}

// Quarantine = bubble
function BubbleCage() {
  return (
    <mesh position={[0, 0.4, 0]}>
      <sphereGeometry args={[0.7, 16, 16]} />
      <meshStandardMaterial color="#FF6B6B" transparent opacity={0.2} wireframe />
    </mesh>
  )
}

export default function DeviceNode({ device }) {
  const selectDevice = useStore((s) => s.selectDevice)
  const getTrustColor = useStore((s) => s.getTrustColor)
  const glowRef = useRef()
  const bobRef = useRef()

  const color = device.status === 'quarantined' ? '#888888' : getTrustColor(device.trust)
  const isCompromised = device.status === 'compromised'
  const isQuarantined = device.status === 'quarantined'
  const isHoneypot = device.type === 'honeypot'

  useFrame((state) => {
    // Gentle bobbing for all devices
    if (bobRef.current) {
      bobRef.current.position.y = device.pos[1] + Math.sin(state.clock.elapsedTime * 1.5 + device.pos[0]) * 0.05
    }
    // Compromised pulse
    if (glowRef.current && isCompromised) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.3
      glowRef.current.scale.set(s, s, s)
      glowRef.current.material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 4) * 0.2
    }
  })

  return (
    <group
      ref={bobRef}
      position={[device.pos[0], device.pos[1], device.pos[2]]}
      onClick={(e) => { e.stopPropagation(); selectDevice(device.id) }}
    >
      {/* Device mesh based on type */}
      {device.type === 'pc' && <ChaoPC color={color} />}
      {device.type === 'server' && <CrystalServer color={color} />}
      {device.type === 'router' && <StarRouter color={color} />}
      {device.type === 'printer' && <ChestPrinter color={color} />}
      {device.type === 'honeypot' && <ChaoPC color={color} />}

      {/* Honeypot jar */}
      {isHoneypot && <HoneypotJar />}

      {/* Compromised glow ring */}
      {isCompromised && (
        <mesh ref={glowRef} position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.7, 24]} />
          <meshBasicMaterial color="#E60026" transparent opacity={0.4} side={2} />
        </mesh>
      )}

      {/* Quarantine bubble */}
      {isQuarantined && <BubbleCage />}

      {/* Device label */}
      <Text
        position={[0, isHoneypot ? 1.3 : 1.0, 0]}
        fontSize={0.12}
        color="#FFFFFF"
        font="/PressStart2P-Regular.ttf"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="#333"
      >
        {device.id}
      </Text>
    </group>
  )
}
