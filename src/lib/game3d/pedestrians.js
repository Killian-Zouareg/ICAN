import * as THREE from 'three'

// Shared geometries (disposed once at top level)
const HEAD_GEO = new THREE.BoxGeometry(0.45, 0.45, 0.45)
const TORSO_GEO = new THREE.BoxGeometry(0.6, 0.8, 0.35)
const LIMB_GEO = new THREE.BoxGeometry(0.18, 0.65, 0.18)
LIMB_GEO.translate(0, -0.325, 0)

const SHIRT_PALETTE = [
  0xc0392b, 0x2980b9, 0x27ae60, 0x8e44ad, 0xd35400,
  0x16a085, 0xe67e22, 0x7f8c8d, 0x2c3e50, 0xc0a080,
]
const PANTS_PALETTE = [0x34495e, 0x2c3e50, 0x795548, 0x424242, 0x4e342e]
const SKIN_PALETTE = [0xf1d5b0, 0xe0ac69, 0xc68642, 0x8d5524, 0xf4c9a1]

function mulberry32(seed) {
  let s = seed >>> 0
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildPedestrian(rng) {
  const root = new THREE.Group()
  const hipHeight = 0.8
  const shoulderHeight = hipHeight + 0.65

  const shirt = new THREE.MeshLambertMaterial({ color: SHIRT_PALETTE[Math.floor(rng() * SHIRT_PALETTE.length)] })
  const pants = new THREE.MeshLambertMaterial({ color: PANTS_PALETTE[Math.floor(rng() * PANTS_PALETTE.length)] })
  const skin = new THREE.MeshLambertMaterial({ color: SKIN_PALETTE[Math.floor(rng() * SKIN_PALETTE.length)] })
  const disposables = [shirt, pants, skin]

  const torso = new THREE.Mesh(TORSO_GEO, shirt)
  torso.position.y = hipHeight + 0.4
  root.add(torso)

  const head = new THREE.Mesh(HEAD_GEO, skin)
  head.position.y = shoulderHeight + 0.3
  root.add(head)

  const armL = new THREE.Mesh(LIMB_GEO, shirt)
  armL.position.set(-0.4, shoulderHeight, 0)
  root.add(armL)
  const armR = new THREE.Mesh(LIMB_GEO, shirt)
  armR.position.set(0.4, shoulderHeight, 0)
  root.add(armR)
  const legL = new THREE.Mesh(LIMB_GEO, pants)
  legL.position.set(-0.16, hipHeight, 0)
  root.add(legL)
  const legR = new THREE.Mesh(LIMB_GEO, pants)
  legR.position.set(0.16, hipHeight, 0)
  root.add(legR)

  root.userData.animate = (phase) => {
    const swing = Math.sin(phase) * 0.8
    armL.rotation.x = swing
    armR.rotation.x = -swing
    legL.rotation.x = -swing
    legR.rotation.x = swing
  }

  return { root, disposables }
}

export function createPedestrians({ count = 24, obstacles = [], halfWorld = 60, seed = 1337 } = {}) {
  const rng = mulberry32(seed)
  const group = new THREE.Group()
  const allDisposables = []
  const peds = []

  const spawnOk = (x, z) => {
    const r = 0.5
    for (const o of obstacles) {
      if (x + r > o.minX && x - r < o.maxX && z + r > o.minZ && z - r < o.maxZ) return false
    }
    return true
  }

  const randomPoint = () => {
    for (let i = 0; i < 30; i++) {
      const x = (rng() - 0.5) * 2 * (halfWorld - 3)
      const z = (rng() - 0.5) * 2 * (halfWorld - 3)
      if (spawnOk(x, z)) return { x, z }
    }
    return null
  }

  for (let i = 0; i < count; i++) {
    const spawn = randomPoint()
    if (!spawn) continue
    const { root, disposables } = buildPedestrian(rng)
    root.position.set(spawn.x, 0, spawn.z)
    root.rotation.y = rng() * Math.PI * 2
    group.add(root)
    allDisposables.push(...disposables)
    const target = randomPoint() || spawn
    peds.push({
      mesh: root,
      target: new THREE.Vector3(target.x, 0, target.z),
      speed: 1.2 + rng() * 0.8,
      phase: rng() * Math.PI * 2,
      pauseUntil: 0,
    })
  }

  const tmp = new THREE.Vector3()

  const update = (dt, nowMs) => {
    for (const p of peds) {
      if (nowMs < p.pauseUntil) {
        p.mesh.userData.animate?.(0)
        continue
      }
      tmp.copy(p.target).sub(p.mesh.position)
      tmp.y = 0
      const dist = tmp.length()
      if (dist < 0.3) {
        // pick new target, sometimes pause
        const pt = randomPoint()
        if (pt) p.target.set(pt.x, 0, pt.z)
        if (rng() < 0.35) p.pauseUntil = nowMs + 800 + rng() * 2200
        continue
      }
      tmp.divideScalar(dist) // normalize
      const step = p.speed * dt
      const nx = p.mesh.position.x + tmp.x * step
      const nz = p.mesh.position.z + tmp.z * step
      if (!spawnOk(nx, nz)) {
        const pt = randomPoint()
        if (pt) p.target.set(pt.x, 0, pt.z)
        continue
      }
      p.mesh.position.x = nx
      p.mesh.position.z = nz
      const facing = Math.atan2(tmp.x, tmp.z) + Math.PI
      const rotDelta = ((facing - p.mesh.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI
      p.mesh.rotation.y += rotDelta * Math.min(1, dt * 8)
      p.phase += dt * 7
      p.mesh.userData.animate?.(p.phase)
    }
  }

  const dispose = () => {
    for (const d of allDisposables) d.dispose?.()
  }

  return { group, update, dispose, count: peds.length }
}
