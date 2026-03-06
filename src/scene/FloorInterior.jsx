import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import useStore from '../store/useStore'
import DeviceNode from './DeviceNode'

// === Shared ===

function ConnectionLine({ from, to, color = '#7BC8F6' }) {
  const dx = to[0] - from[0]
  const dz = to[2] - from[2]
  const len = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dx, dz)
  const cx = (from[0] + to[0]) / 2
  const cz = (from[2] + to[2]) / 2
  return (
    <mesh rotation={[-Math.PI / 2, 0, -angle]} position={[cx, 0.03, cz]}>
      <planeGeometry args={[0.08, len]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.7} />
    </mesh>
  )
}

function DataPulse({ from, to, color = '#FFD93D', speed = 1 }) {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    const t = (state.clock.elapsedTime * speed * 0.3) % 1
    ref.current.position.x = from[0] + (to[0] - from[0]) * t
    ref.current.position.z = from[2] + (to[2] - from[2]) * t
    ref.current.material.opacity = 0.6 + Math.sin(t * Math.PI) * 0.4
  })
  return (
    <mesh ref={ref} position={[from[0], 0.1, from[2]]}>
      <sphereGeometry args={[0.08, 6, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.9} />
    </mesh>
  )
}

function EdgeRing({ radius = 9, color = '#7BC8F6' }) {
  return (
    <mesh position={[0, 0.02, 0]}>
      <torusGeometry args={[radius, 0.06, 6, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </mesh>
  )
}

function FloatingRing({ position, color, size = 0.6, speed = 1 }) {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * speed
      ref.current.rotation.z = state.clock.elapsedTime * speed * 0.5
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.5) * 0.15
    }
  })
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[size, 0.06, 8, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </mesh>
  )
}

function BouncingOrb({ position, color, size = 0.15 }) {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.abs(Math.sin(state.clock.elapsedTime * 2 + position[0])) * 0.4
    }
  })
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.8} />
    </mesh>
  )
}

// Collectible gold ring (Sonic style)
function GoldRing({ position, speed = 1 }) {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * speed * 2
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.5 + position[0]) * 0.1
    }
  })
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[0.25, 0.06, 8, 16]} />
      <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={1.2} />
    </mesh>
  )
}

function useConnections(devices) {
  return useMemo(() => {
    if (devices.length < 2) return []
    const conns = []
    for (let i = 0; i < devices.length; i++) {
      const next = (i + 1) % devices.length
      conns.push({ from: devices[i].pos, to: devices[next].pos })
    }
    for (let i = 0; i < devices.length; i++) {
      conns.push({ from: devices[i].pos, to: [0, 0, 0] })
    }
    return conns
  }, [devices])
}

// === Sonic-style character statue ===
function SonicStatue({ position }) {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.3
  })
  return (
    <group ref={ref} position={position}>
      {/* Pedestal */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.5, 0.6, 0.3, 8]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      {/* Body - blue */}
      <mesh position={[0, 0.7, 0]}>
        <capsuleGeometry args={[0.25, 0.4, 8, 8]} />
        <meshStandardMaterial color="#1565C0" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.15, 0]}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial color="#1565C0" />
      </mesh>
      {/* Quills (spikes) */}
      {[-0.3, -0.15, 0].map((offset, i) => (
        <mesh key={i} position={[-0.15, 1.15 + offset * 0.3, -0.15]} rotation={[0.5 + i * 0.15, 0, -0.3]}>
          <coneGeometry args={[0.08, 0.35, 4]} />
          <meshStandardMaterial color="#1565C0" />
        </mesh>
      ))}
      {/* Belly */}
      <mesh position={[0, 0.65, 0.12]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#F5DEB3" />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.08, 1.2, 0.18]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#FFF" />
      </mesh>
      <mesh position={[-0.05, 1.2, 0.18]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#FFF" />
      </mesh>
      {/* Pupils */}
      <mesh position={[0.09, 1.2, 0.22]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[-0.04, 1.2, 0.22]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Shoes - red */}
      <mesh position={[0.1, 0.35, 0.05]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color="#D32F2F" />
      </mesh>
      <mesh position={[-0.1, 0.35, 0.05]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color="#D32F2F" />
      </mesh>
    </group>
  )
}

// === Chao creature ===
function ChaoCreature({ position, color = '#7BC8F6' }) {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.2 + position[0]) * 0.12
    }
  })
  return (
    <group ref={ref} position={position}>
      {/* Body */}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head orb */}
      <mesh position={[0, 0.78, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={1} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.06, 0.58, 0.14]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[-0.06, 0.58, 0.14]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Blush */}
      <mesh position={[0.1, 0.52, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#FF9999" transparent opacity={0.5} />
      </mesh>
      <mesh position={[-0.1, 0.52, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#FF9999" transparent opacity={0.5} />
      </mesh>
      {/* Tiny wings */}
      <mesh position={[0.18, 0.35, -0.05]} rotation={[0, 0, 0.5]}>
        <planeGeometry args={[0.15, 0.1]} />
        <meshStandardMaterial color="#FFFFFFAA" transparent opacity={0.6} side={2} />
      </mesh>
      <mesh position={[-0.18, 0.35, -0.05]} rotation={[0, 0, -0.5]}>
        <planeGeometry args={[0.15, 0.1]} />
        <meshStandardMaterial color="#FFFFFFAA" transparent opacity={0.6} side={2} />
      </mesh>
    </group>
  )
}

// === FL.1 GREEN HILL ZONE — Bright blue checkerboard, Sonic statue, gold rings ===

function GreenHillFloor({ connections }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <circleGeometry args={[9, 24]} />
        <meshStandardMaterial color="#4488CC" />
      </mesh>

      {/* Checkerboard */}
      {Array.from({ length: 8 }).map((_, xi) =>
        Array.from({ length: 8 }).map((_, zi) => {
          const x = (xi - 3.5) * 2
          const z = (zi - 3.5) * 2
          if (x * x + z * z > 60) return null
          return (
            <mesh key={`${xi}-${zi}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]}>
              <planeGeometry args={[1.9, 1.9]} />
              <meshStandardMaterial color={(xi + zi) % 2 === 0 ? '#5599DD' : '#3377BB'} transparent opacity={0.5} />
            </mesh>
          )
        })
      )}

      {/* Sonic statue in center */}
      <SonicStatue position={[0, 0, 0]} />

      {/* Scattered gold rings */}
      <GoldRing position={[-4, 0.6, -3]} speed={1} />
      <GoldRing position={[4, 0.6, 2]} speed={1.2} />
      <GoldRing position={[-2, 0.6, 4]} speed={0.8} />
      <GoldRing position={[3, 0.6, -4]} speed={1.1} />
      <GoldRing position={[6, 0.6, 0]} speed={0.9} />

      {/* Small green hill bumps */}
      <mesh position={[-6, 0.15, -5]}>
        <sphereGeometry args={[0.8, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#4CAF50" />
      </mesh>
      <mesh position={[5, 0.12, 5]}>
        <sphereGeometry args={[0.6, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#5CBF60" />
      </mesh>

      {connections.map((c, i) => <ConnectionLine key={i} from={c.from} to={c.to} color="#FFD700" />)}
      {connections.slice(0, 4).map((c, i) => <DataPulse key={`p-${i}`} from={c.from} to={c.to} color="#FFFFFF" speed={1 + i * 0.3} />)}

      <EdgeRing color="#FFD700" />
    </>
  )
}

// === FL.2 YAKUZA — Dark city streets, neon signs, red lanterns, urban grit ===

function KamuroChoFloor({ connections }) {
  return (
    <>
      {/* Dark asphalt ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <circleGeometry args={[9, 24]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>

      {/* Street grid lines */}
      {[-6, -3, 0, 3, 6].map((x, i) => (
        <mesh key={`sh-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]}>
          <planeGeometry args={[0.06, 16]} />
          <meshStandardMaterial color="#444" transparent opacity={0.5} />
        </mesh>
      ))}
      {[-6, -3, 0, 3, 6].map((z, i) => (
        <mesh key={`sv-${i}`} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.01, z]}>
          <planeGeometry args={[0.06, 16]} />
          <meshStandardMaterial color="#444" transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Neon sign boards (vertical, glowing) */}
      {[
        { pos: [-6, 1.2, -2], color: '#FF1493', h: 2.0 },
        { pos: [6, 1.0, 3], color: '#00BFFF', h: 1.6 },
        { pos: [-5, 0.8, 5], color: '#FF6347', h: 1.2 },
        { pos: [5, 1.1, -4], color: '#FFD700', h: 1.8 },
      ].map((sign, i) => (
        <group key={`sign-${i}`}>
          {/* Sign pole */}
          <mesh position={[sign.pos[0], sign.h / 2, sign.pos[2]]}>
            <cylinderGeometry args={[0.04, 0.04, sign.h, 4]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          {/* Neon board */}
          <mesh position={sign.pos}>
            <boxGeometry args={[0.08, 0.8, 1.2]} />
            <meshStandardMaterial color={sign.color} emissive={sign.color} emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}

      {/* Red lanterns hanging */}
      {[[-3, 1.5, -5], [2, 1.4, -3], [-1, 1.6, 4], [4, 1.3, 1], [-4, 1.5, 2]].map(([x, yy, z], i) => (
        <group key={`lantern-${i}`} position={[x, yy, z]}>
          {/* String */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.4, 3]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          {/* Lantern body */}
          <mesh>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial color="#CC0000" emissive="#CC0000" emissiveIntensity={0.8} transparent opacity={0.85} />
          </mesh>
          {/* Top/bottom rings */}
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.03, 6]} />
            <meshStandardMaterial color="#8B6914" />
          </mesh>
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 6]} />
            <meshStandardMaterial color="#8B6914" />
          </mesh>
        </group>
      ))}

      {/* Manhole covers */}
      {[[2, -5], [-4, -4], [0, 2]].map(([x, z], i) => (
        <mesh key={`mh-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]}>
          <circleGeometry args={[0.4, 12]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}

      {/* Puddle reflections */}
      {[[-2, 3], [3, -2], [-5, -1]].map(([x, z], i) => (
        <mesh key={`puddle-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.015, z]}>
          <circleGeometry args={[0.6 + i * 0.2, 10]} />
          <meshStandardMaterial color="#2A2A3A" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Vending machine style boxes */}
      {[[7, -1], [-7, 0]].map(([x, z], i) => (
        <group key={`vend-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[0.5, 0.9, 0.4]} />
            <meshStandardMaterial color="#225" />
          </mesh>
          <mesh position={[0, 0.5, 0.21]}>
            <planeGeometry args={[0.4, 0.6]} />
            <meshStandardMaterial color={i === 0 ? '#00BFFF' : '#FF6347'} emissive={i === 0 ? '#00BFFF' : '#FF6347'} emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}

      {connections.map((c, i) => <ConnectionLine key={i} from={c.from} to={c.to} color="#FF1493" />)}
      {connections.slice(0, 4).map((c, i) => <DataPulse key={`p-${i}`} from={c.from} to={c.to} color="#FF6347" speed={1.2 + i * 0.2} />)}

      <EdgeRing color="#CC0000" />
    </>
  )
}

// === FL.3 PERSONA — Red/black Metaverse, tarot motifs, Phantom Thieves style ===

function PersonaMetaverseFloor({ connections }) {
  const maskRef = useRef()
  useFrame((state) => {
    if (maskRef.current) maskRef.current.rotation.y = state.clock.elapsedTime * 0.4
  })

  return (
    <>
      {/* Deep black ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <circleGeometry args={[9, 24]} />
        <meshStandardMaterial color="#0A0A0A" />
      </mesh>

      {/* Red veins / cracks pattern */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <mesh key={`vein-${i}`} rotation={[-Math.PI / 2, 0, -a]} position={[Math.cos(a) * 4.5, 0.01, Math.sin(a) * 4.5]}>
            <planeGeometry args={[0.06, 9]} />
            <meshStandardMaterial color="#CC0000" emissive="#CC0000" emissiveIntensity={0.6} transparent opacity={0.5} />
          </mesh>
        )
      })}

      {/* Concentric red rings */}
      {[2, 4, 6, 8].map((r, i) => (
        <mesh key={`ring-${i}`} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r - 0.04, r + 0.04, 32]} />
          <meshStandardMaterial color="#CC0000" emissive="#CC0000" emissiveIntensity={0.4} transparent opacity={0.3 + i * 0.05} />
        </mesh>
      ))}

      {/* Central Phantom Thieves mask (simplified) */}
      <group ref={maskRef} position={[0, 0.5, 0]}>
        {/* Mask face */}
        <mesh>
          <sphereGeometry args={[0.4, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
        {/* Eye holes */}
        <mesh position={[0.12, 0.1, 0.3]}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[-0.12, 0.1, 0.3]}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        {/* Mask pointed edges */}
        <mesh position={[0.35, 0.05, 0.15]} rotation={[0, 0, -0.5]}>
          <coneGeometry args={[0.08, 0.3, 4]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[-0.35, 0.05, 0.15]} rotation={[0, 0, 0.5]}>
          <coneGeometry args={[0.08, 0.3, 4]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      </group>

      {/* Tarot card stands */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2
        const x = Math.cos(a) * 6.5
        const z = Math.sin(a) * 6.5
        const cardColors = ['#CC0000', '#FFD700', '#CC0000', '#FFD700', '#CC0000', '#FFD700']
        return (
          <group key={`tarot-${i}`} position={[x, 0, z]}>
            {/* Card */}
            <mesh position={[0, 0.6, 0]} rotation={[0, -a, 0]}>
              <boxGeometry args={[0.5, 0.8, 0.03]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            {/* Card border */}
            <mesh position={[0, 0.6, 0.02]} rotation={[0, -a, 0]}>
              <planeGeometry args={[0.42, 0.72]} />
              <meshStandardMaterial color={cardColors[i]} emissive={cardColors[i]} emissiveIntensity={0.5} />
            </mesh>
            {/* Card symbol (diamond) */}
            <mesh position={[0, 0.65, 0.035]} rotation={[0, -a, Math.PI / 4]}>
              <planeGeometry args={[0.15, 0.15]} />
              <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.3} />
            </mesh>
          </group>
        )
      })}

      {/* Floating red chains (decorative arcs) */}
      {[[-4, 0.8, -4], [4, 0.9, 3], [-3, 0.7, 5]].map(([x, yy, z], i) => (
        <mesh key={`chain-${i}`} position={[x, yy, z]}>
          <torusGeometry args={[0.3, 0.04, 6, 8]} />
          <meshStandardMaterial color="#CC0000" emissive="#CC0000" emissiveIntensity={0.8} />
        </mesh>
      ))}

      {/* Bouncing red orbs */}
      <BouncingOrb position={[5, 0.3, -2]} color="#CC0000" />
      <BouncingOrb position={[-5, 0.3, 3]} color="#CC0000" />
      <BouncingOrb position={[2, 0.3, 5]} color="#FFD700" />

      {connections.map((c, i) => <ConnectionLine key={i} from={c.from} to={c.to} color="#CC0000" />)}
      {connections.slice(0, 6).map((c, i) => <DataPulse key={`p-${i}`} from={c.from} to={c.to} color="#FFD700" speed={1 + i * 0.25} />)}

      <EdgeRing color="#CC0000" />
    </>
  )
}

// === FL.4 SHENMUE — Serene Asian garden, dojo, cherry blossoms, stone lanterns ===

function ShenmueDojoFloor({ connections }) {
  const petalRefs = useRef([])

  useFrame((state) => {
    petalRefs.current.forEach((ref, i) => {
      if (!ref) return
      const t = state.clock.elapsedTime * 0.3 + i * 1.5
      ref.position.y = 0.5 + Math.sin(t) * 0.8
      ref.position.x = ref.userData.startX + Math.sin(t * 0.7) * 1.5
      ref.position.z = ref.userData.startZ + Math.cos(t * 0.5) * 1.0
      ref.rotation.z = t * 2
    })
  })

  return (
    <>
      {/* Warm earthy ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <circleGeometry args={[9, 24]} />
        <meshStandardMaterial color="#3D2B1F" />
      </mesh>

      {/* Inner zen sand circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <circleGeometry args={[6, 24]} />
        <meshStandardMaterial color="#D4C4A8" />
      </mesh>

      {/* Zen sand raking circles */}
      {[1.5, 2.5, 3.5, 4.5, 5.5].map((r, i) => (
        <mesh key={`zen-${i}`} position={[0, -0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r - 0.03, r + 0.03, 32]} />
          <meshStandardMaterial color="#C0B090" transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Central dojo platform */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[2.5, 0.16, 2.5]} />
        <meshStandardMaterial color="#8B6914" />
      </mesh>
      {/* Dojo tatami top */}
      <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 2.4]} />
        <meshStandardMaterial color="#9AAF5C" />
      </mesh>

      {/* Stone lanterns (toro) */}
      {[[5, -5], [-5, -5], [5, 5], [-5, 5]].map(([x, z], i) => (
        <group key={`lantern-${i}`} position={[x, 0, z]}>
          {/* Base */}
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.25, 0.3, 0.2, 6]} />
            <meshStandardMaterial color="#888" />
          </mesh>
          {/* Pillar */}
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.6, 6]} />
            <meshStandardMaterial color="#999" />
          </mesh>
          {/* Light box */}
          <mesh position={[0, 0.85, 0]}>
            <boxGeometry args={[0.35, 0.3, 0.35]} />
            <meshStandardMaterial color="#AAA" />
          </mesh>
          {/* Light glow */}
          <mesh position={[0, 0.85, 0]}>
            <boxGeometry args={[0.25, 0.2, 0.25]} />
            <meshStandardMaterial color="#FFCC66" emissive="#FFCC66" emissiveIntensity={1.0} transparent opacity={0.7} />
          </mesh>
          {/* Roof */}
          <mesh position={[0, 1.08, 0]}>
            <coneGeometry args={[0.3, 0.2, 4]} />
            <meshStandardMaterial color="#777" />
          </mesh>
        </group>
      ))}

      {/* Cherry blossom trees */}
      {[[-3, -6], [4, -6], [0, 7]].map(([x, z], i) => (
        <group key={`tree-${i}`} position={[x, 0, z]}>
          {/* Trunk */}
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.06, 0.1, 1.0, 5]} />
            <meshStandardMaterial color="#5D3A1A" />
          </mesh>
          {/* Branches */}
          <mesh position={[0.2, 0.9, 0]} rotation={[0, 0, -0.4]}>
            <cylinderGeometry args={[0.03, 0.04, 0.5, 4]} />
            <meshStandardMaterial color="#5D3A1A" />
          </mesh>
          <mesh position={[-0.15, 0.85, 0.1]} rotation={[0.3, 0, 0.3]}>
            <cylinderGeometry args={[0.03, 0.04, 0.4, 4]} />
            <meshStandardMaterial color="#5D3A1A" />
          </mesh>
          {/* Blossom clusters */}
          {[[0, 1.1, 0], [0.35, 1.05, 0], [-0.2, 1.0, 0.15], [0.1, 1.15, -0.1]].map(([bx, by, bz], j) => (
            <mesh key={j} position={[bx, by, bz]}>
              <sphereGeometry args={[0.2, 6, 6]} />
              <meshStandardMaterial color="#FFB7C5" transparent opacity={0.85} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Falling cherry blossom petals */}
      {Array.from({ length: 8 }).map((_, i) => {
        const sx = (Math.random() - 0.5) * 12
        const sz = (Math.random() - 0.5) * 12
        return (
          <mesh
            key={`petal-${i}`}
            ref={(el) => {
              if (el) {
                el.userData.startX = sx
                el.userData.startZ = sz
                petalRefs.current[i] = el
              }
            }}
            position={[sx, 0.8, sz]}
          >
            <planeGeometry args={[0.08, 0.06]} />
            <meshStandardMaterial color="#FFB7C5" emissive="#FFB7C5" emissiveIntensity={0.3} transparent opacity={0.7} side={2} />
          </mesh>
        )
      })}

      {/* Zen rocks */}
      {[[2, 3], [-2, -2], [3, -1]].map(([x, z], i) => (
        <mesh key={`rock-${i}`} position={[x, 0.1 + i * 0.03, z]}>
          <dodecahedronGeometry args={[0.2 + i * 0.05, 0]} />
          <meshStandardMaterial color="#666" />
        </mesh>
      ))}

      {/* Small wooden bridge */}
      <group position={[3, 0, 4]}>
        <mesh position={[0, 0.12, 0]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[1.5, 0.06, 0.6]} />
          <meshStandardMaterial color="#8B6914" />
        </mesh>
        <mesh position={[-0.7, 0.08, 0]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.06, 0.16, 0.6]} />
          <meshStandardMaterial color="#8B6914" />
        </mesh>
        <mesh position={[0.7, 0.08, 0]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.06, 0.16, 0.6]} />
          <meshStandardMaterial color="#8B6914" />
        </mesh>
      </group>

      {connections.map((c, i) => <ConnectionLine key={i} from={c.from} to={c.to} color="#FFCC66" />)}
      {connections.slice(0, 4).map((c, i) => <DataPulse key={`p-${i}`} from={c.from} to={c.to} color="#FFB7C5" speed={0.8 + i * 0.3} />)}

      <EdgeRing color="#8B6914" />
    </>
  )
}

// === FL.5 CHAO GARDEN — Soft green, water, Chao creatures, dreamy ===

function ChaoGardenFloor({ connections }) {
  return (
    <>
      {/* Grassy ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <circleGeometry args={[9, 24]} />
        <meshStandardMaterial color="#2D5A27" />
      </mesh>

      {/* Inner lighter grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <circleGeometry args={[7, 24]} />
        <meshStandardMaterial color="#3A7233" />
      </mesh>

      {/* Pond in corner */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4, 0.01, 4]}>
        <circleGeometry args={[1.5, 16]} />
        <meshStandardMaterial color="#5BC0EB" transparent opacity={0.6} />
      </mesh>
      {/* Pond stones */}
      {[0, 1, 2, 3, 4, 5].map((a, i) => (
        <mesh key={i} position={[-4 + Math.cos(a) * 1.7, 0.05, 4 + Math.sin(a) * 1.7]}>
          <sphereGeometry args={[0.12, 5, 5]} />
          <meshStandardMaterial color="#AAA" />
        </mesh>
      ))}

      {/* Small trees/bushes */}
      {[[5, -4], [-5, -3], [6, 3]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.4, 5]} />
            <meshStandardMaterial color="#8B5E3C" />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <sphereGeometry args={[0.35, 8, 8]} />
            <meshStandardMaterial color="#5CBF60" />
          </mesh>
        </group>
      ))}

      {/* Chao creatures scattered around */}
      <ChaoCreature position={[-2, 0, -3]} color="#7BC8F6" />
      <ChaoCreature position={[3, 0, 2]} color="#FF8FA3" />
      <ChaoCreature position={[-5, 0, 1]} color="#FFD93D" />
      <ChaoCreature position={[1, 0, 5]} color="#9B5DE5" />

      {/* Scattered flowers */}
      {[[-3, 5], [4, -5], [-6, -2], [2, -4], [5, 5]].map(([x, z], i) => {
        const colors = ['#FF69B4', '#FFD93D', '#FF6B6B', '#9B5DE5', '#7BC8F6']
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.2, 3]} />
              <meshStandardMaterial color="#5D8C3E" />
            </mesh>
            {[0, 1.25, 2.5, 3.75, 5].map((rot, j) => (
              <mesh key={j} position={[Math.cos(rot) * 0.06, 0.22, Math.sin(rot) * 0.06]}>
                <sphereGeometry args={[0.04, 4, 4]} />
                <meshStandardMaterial color={colors[i]} />
              </mesh>
            ))}
          </group>
        )
      })}

      {/* Gentle gold rings floating */}
      <GoldRing position={[0, 0.8, 0]} speed={0.5} />
      <GoldRing position={[4, 0.8, -2]} speed={0.7} />

      {connections.map((c, i) => <ConnectionLine key={i} from={c.from} to={c.to} color="#00C851" />)}
      {connections.slice(0, 4).map((c, i) => <DataPulse key={`p-${i}`} from={c.from} to={c.to} color="#FFD700" speed={0.8 + i * 0.2} />)}

      <EdgeRing color="#00E676" />
    </>
  )
}

// === Main ===

const FLOOR_COMPONENTS = {
  1: GreenHillFloor,
  2: KamuroChoFloor,
  3: PersonaMetaverseFloor,
  4: ShenmueDojoFloor,
  5: ChaoGardenFloor,
}

export default function FloorInterior({ floor, y }) {
  const allDevices = useStore((s) => s.devices)
  const devices = useMemo(() => allDevices.filter(d => d.floor === floor.id), [allDevices, floor.id])
  const connections = useConnections(devices)

  const FloorComponent = FLOOR_COMPONENTS[floor.id] || CyberCityFloor

  return (
    <group position={[0, y, 0]}>
      <FloorComponent devices={devices} connections={connections} />
      {devices.map((device) => (
        <DeviceNode key={device.id} device={device} />
      ))}
    </group>
  )
}
