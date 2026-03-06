import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import useStore from '../store/useStore'

const CAMERA_STATES = {
  1: { position: [30, 22, 30], target: [0, 2, 0] },
  2: { position: [0, 16, 28], target: [0, 8, 0] },
}

export default function CameraController() {
  const { camera } = useThree()
  const controlsRef = useRef()
  const zoomLevel = useStore((s) => s.zoomLevel)
  const selectedFloor = useStore((s) => s.selectedFloor)
  const goBack = useStore((s) => s.goBack)

  const animating = useRef(false)
  const startPos = useRef(new THREE.Vector3())
  const startTarget = useRef(new THREE.Vector3())
  const endPos = useRef(new THREE.Vector3(30, 22, 30))
  const endTarget = useRef(new THREE.Vector3(0, 2, 0))
  const animT = useRef(1)

  const getTarget = () => {
    if (zoomLevel === 3 && selectedFloor) {
      const floorY = (selectedFloor - 1) * 3.5 + 1.0
      return {
        position: [10, floorY + 7, 10],
        target: [0, floorY, 0],
      }
    }
    return CAMERA_STATES[zoomLevel] || CAMERA_STATES[1]
  }

  // Trigger animation when zoom level or floor changes
  const prevZoom = useRef(zoomLevel)
  const prevFloor = useRef(selectedFloor)
  useEffect(() => {
    if (prevZoom.current !== zoomLevel || prevFloor.current !== selectedFloor) {
      const dest = getTarget()
      // Capture current positions as start
      startPos.current.copy(camera.position)
      if (controlsRef.current) {
        startTarget.current.copy(controlsRef.current.target)
      }
      endPos.current.set(...dest.position)
      endTarget.current.set(...dest.target)
      animT.current = 0
      animating.current = true
      prevZoom.current = zoomLevel
      prevFloor.current = selectedFloor
    }
  }, [zoomLevel, selectedFloor])

  const tmpPos = useRef(new THREE.Vector3())
  const tmpTarget = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    if (!animating.current || !controlsRef.current) return

    animT.current = Math.min(animT.current + delta * 3, 1)
    // Smooth ease-in-out
    const t = animT.current < 0.5
      ? 4 * animT.current * animT.current * animT.current
      : 1 - Math.pow(-2 * animT.current + 2, 3) / 2

    tmpPos.current.lerpVectors(startPos.current, endPos.current, t)
    tmpTarget.current.lerpVectors(startTarget.current, endTarget.current, t)

    camera.position.copy(tmpPos.current)
    controlsRef.current.target.copy(tmpTarget.current)
    controlsRef.current.update()

    if (animT.current >= 1) {
      animating.current = false
    }
  })

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') goBack()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goBack])

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={3}
      maxDistance={60}
      maxPolarAngle={Math.PI / 2.1}
      minPolarAngle={0.1}
      enableDamping={true}
      dampingFactor={0.08}
      rotateSpeed={0.6}
      zoomSpeed={1.0}
      panSpeed={0.5}
      target={[0, 2, 0]}
    />
  )
}
