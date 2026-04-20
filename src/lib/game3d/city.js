import * as THREE from 'three'

const BLOCK = 26
const ROAD_WIDTH = 7
const GRID_HALF = 3

export const CITY_HALF = GRID_HALF * BLOCK + ROAD_WIDTH

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeWindowTexture(cols, rows, accent) {
  const cell = 32
  const canvas = document.createElement('canvas')
  canvas.width = cols * cell
  canvas.height = rows * cell
  const ctx = canvas.getContext('2d')
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height)
  grd.addColorStop(0, '#d4c9b0')
  grd.addColorStop(1, '#b5a88d')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = Math.random() < 0.35
      ctx.fillStyle = lit ? accent : '#1a2430'
      const px = x * cell + 6
      const py = y * cell + 8
      ctx.fillRect(px, py, cell - 12, cell - 16)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(px, py, cell - 12, 2)
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 1
      ctx.strokeRect(px, py, cell - 12, cell - 16)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeRoadTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#2a2a2d'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#f5d75e'
  for (let y = 20; y < canvas.height; y += 60) {
    ctx.fillRect(canvas.width / 2 - 3, y, 6, 30)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeSidewalkTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#b8b5af'
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = '#9a968f'
  ctx.lineWidth = 2
  for (let i = 0; i <= 128; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function addBox(group, size, pos, material, obstacles, solid = true) {
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z)
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set(pos.x, pos.y, pos.z)
  group.add(mesh)
  if (solid && obstacles) {
    obstacles.push({
      minX: pos.x - size.x / 2,
      maxX: pos.x + size.x / 2,
      minZ: pos.z - size.z / 2,
      maxZ: pos.z + size.z / 2,
    })
  }
  return { mesh, geo }
}

function buildApartment(rng, cx, cz, plotW, plotD) {
  const group = new THREE.Group()
  const w = plotW * (0.55 + rng() * 0.25)
  const d = plotD * (0.55 + rng() * 0.25)
  const floors = 3 + Math.floor(rng() * 5)
  const h = floors * 3
  const cols = Math.max(3, Math.round(w / 2))
  const accents = ['#ffcc66', '#ffa040', '#ffd7b5', '#7fb8ff']
  const accent = accents[Math.floor(rng() * accents.length)]
  const winTex = makeWindowTexture(cols, floors, accent)
  winTex.repeat.set(1, 1)
  const sideTex = makeWindowTexture(Math.max(2, Math.round(d / 2)), floors, accent)
  const wallMat = new THREE.MeshLambertMaterial({ map: winTex })
  const sideMat = new THREE.MeshLambertMaterial({ map: sideTex })
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3b3b42 })

  const mats = [sideMat, sideMat, roofMat, roofMat, wallMat, wallMat]
  const geo = new THREE.BoxGeometry(w, h, d)
  const mesh = new THREE.Mesh(geo, mats)
  mesh.position.set(cx, h / 2, cz)
  group.add(mesh)

  const capGeo = new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4)
  const cap = new THREE.Mesh(capGeo, roofMat)
  cap.position.set(cx, h + 0.25, cz)
  group.add(cap)

  return {
    group,
    disposables: [geo, capGeo, wallMat, sideMat, roofMat, winTex, sideTex],
    obstacle: { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 },
  }
}

function buildHouse(rng, cx, cz, plotW, plotD) {
  const group = new THREE.Group()
  const w = Math.min(plotW * 0.7, 8)
  const d = Math.min(plotD * 0.7, 7)
  const h = 3 + rng() * 1.2
  const wallColors = [0xe8d9b5, 0xd9b98f, 0xc9b89a, 0xf0c99a, 0xbdd1a0, 0xe4a5a5]
  const roofColors = [0x8b3a2a, 0x6b4e2a, 0x4a3a3a, 0x7a3e3a]
  const wallMat = new THREE.MeshLambertMaterial({ color: wallColors[Math.floor(rng() * wallColors.length)] })
  const roofMat = new THREE.MeshLambertMaterial({ color: roofColors[Math.floor(rng() * roofColors.length)] })
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x3a2818 })

  const bodyGeo = new THREE.BoxGeometry(w, h, d)
  const body = new THREE.Mesh(bodyGeo, wallMat)
  body.position.set(cx, h / 2, cz)
  group.add(body)

  const roofH = 1.8
  const roofGeo = new THREE.CylinderGeometry(0.01, Math.hypot(w / 2, roofH), d, 3, 1, false, 0, Math.PI * 2)
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.scale.set(w / (2 * Math.hypot(w / 2, roofH)), 1, 1)
  roof.rotation.z = Math.PI / 2
  roof.position.set(cx, h + roofH / 2, cz)
  roof.geometry.computeBoundingBox()
  const roofGroup = new THREE.Group()
  roofGroup.position.set(cx, h, cz)

  const prismShape = new THREE.Shape()
  prismShape.moveTo(-w / 2, 0)
  prismShape.lineTo(w / 2, 0)
  prismShape.lineTo(0, roofH)
  prismShape.lineTo(-w / 2, 0)
  const prismGeo = new THREE.ExtrudeGeometry(prismShape, { depth: d, bevelEnabled: false })
  prismGeo.translate(0, 0, -d / 2)
  const prism = new THREE.Mesh(prismGeo, roofMat)
  prism.position.set(cx, h, cz)
  group.add(prism)

  const doorGeo = new THREE.BoxGeometry(0.9, 1.8, 0.1)
  const door = new THREE.Mesh(doorGeo, doorMat)
  door.position.set(cx, 0.9, cz + d / 2 + 0.05)
  group.add(door)

  const winGeo = new THREE.BoxGeometry(0.9, 0.9, 0.05)
  const winMat = new THREE.MeshLambertMaterial({ color: 0x9fd4ff, emissive: 0x223344 })
  for (const offset of [-w / 3, w / 3]) {
    const wf = new THREE.Mesh(winGeo, winMat)
    wf.position.set(cx + offset, h * 0.6, cz + d / 2 + 0.03)
    group.add(wf)
  }

  return {
    group,
    disposables: [bodyGeo, prismGeo, doorGeo, winGeo, wallMat, roofMat, doorMat, winMat, roof.geometry],
    obstacle: { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 },
  }
}

function buildShop(rng, cx, cz, plotW, plotD) {
  const group = new THREE.Group()
  const w = Math.min(plotW * 0.75, 10)
  const d = Math.min(plotD * 0.65, 7)
  const h = 3.2
  const colors = [0xd93f3f, 0x2f6fd0, 0x2ea35a, 0xc87b2a, 0x8b4c9a]
  const wallMat = new THREE.MeshLambertMaterial({ color: colors[Math.floor(rng() * colors.length)] })
  const awningMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const winMat = new THREE.MeshLambertMaterial({ color: 0xbfe6ff, emissive: 0x112233 })
  const signMat = new THREE.MeshLambertMaterial({ color: 0x1a2430 })

  const bodyGeo = new THREE.BoxGeometry(w, h, d)
  const body = new THREE.Mesh(bodyGeo, wallMat)
  body.position.set(cx, h / 2, cz)
  group.add(body)

  const winGeo = new THREE.BoxGeometry(w * 0.85, 1.4, 0.05)
  const win = new THREE.Mesh(winGeo, winMat)
  win.position.set(cx, 1.4, cz + d / 2 + 0.03)
  group.add(win)

  const awningGeo = new THREE.BoxGeometry(w * 0.9, 0.15, 1.2)
  const awning = new THREE.Mesh(awningGeo, awningMat)
  awning.position.set(cx, 2.4, cz + d / 2 + 0.6)
  awning.rotation.x = -0.1
  group.add(awning)

  const signGeo = new THREE.BoxGeometry(w * 0.6, 0.5, 0.2)
  const sign = new THREE.Mesh(signGeo, signMat)
  sign.position.set(cx, h - 0.3, cz + d / 2 + 0.12)
  group.add(sign)

  return {
    group,
    disposables: [bodyGeo, winGeo, awningGeo, signGeo, wallMat, awningMat, winMat, signMat],
    obstacle: { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 },
  }
}

function buildTree(cx, cz) {
  const group = new THREE.Group()
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3a22 })
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a })
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.6, 6)
  const trunk = new THREE.Mesh(trunkGeo, trunkMat)
  trunk.position.set(cx, 0.8, cz)
  group.add(trunk)
  const foliageGeo = new THREE.IcosahedronGeometry(1, 0)
  const foliage = new THREE.Mesh(foliageGeo, leafMat)
  foliage.position.set(cx, 2.1, cz)
  foliage.scale.set(1.1, 1.3, 1.1)
  group.add(foliage)
  return {
    group,
    disposables: [trunkGeo, foliageGeo, trunkMat, leafMat],
    obstacle: { minX: cx - 0.3, maxX: cx + 0.3, minZ: cz - 0.3, maxZ: cz + 0.3 },
  }
}

function buildLamp(cx, cz) {
  const group = new THREE.Group()
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222831 })
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xfff4c2, emissive: 0xffcc66, emissiveIntensity: 0.8 })
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.5, 6)
  const pole = new THREE.Mesh(poleGeo, poleMat)
  pole.position.set(cx, 2.25, cz)
  group.add(pole)
  const armGeo = new THREE.BoxGeometry(0.08, 0.08, 0.8)
  const arm = new THREE.Mesh(armGeo, poleMat)
  arm.position.set(cx, 4.4, cz + 0.4)
  group.add(arm)
  const bulbGeo = new THREE.SphereGeometry(0.22, 8, 6)
  const bulb = new THREE.Mesh(bulbGeo, bulbMat)
  bulb.position.set(cx, 4.4, cz + 0.8)
  group.add(bulb)
  return { group, disposables: [poleGeo, armGeo, bulbGeo, poleMat, bulbMat] }
}

function buildCar(rng, cx, cz, rot) {
  const group = new THREE.Group()
  const colors = [0xd93f3f, 0x2f6fd0, 0xf2d149, 0x2a2a2a, 0xe8e8e8, 0x2ea35a]
  const bodyMat = new THREE.MeshLambertMaterial({ color: colors[Math.floor(rng() * colors.length)] })
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1a2430 })
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111316 })
  const bodyGeo = new THREE.BoxGeometry(2, 0.6, 4)
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.set(0, 0.7, 0)
  group.add(body)
  const cabinGeo = new THREE.BoxGeometry(1.8, 0.7, 2)
  const cabin = new THREE.Mesh(cabinGeo, cabinMat)
  cabin.position.set(0, 1.35, -0.2)
  group.add(cabin)
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 10)
  wheelGeo.rotateZ(Math.PI / 2)
  for (const [x, z] of [[-0.9, -1.3], [0.9, -1.3], [-0.9, 1.3], [0.9, 1.3]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat)
    w.position.set(x, 0.35, z)
    group.add(w)
  }
  group.position.set(cx, 0, cz)
  group.rotation.y = rot
  return {
    group,
    disposables: [bodyGeo, cabinGeo, wheelGeo, bodyMat, cabinMat, wheelMat],
    obstacle: {
      minX: cx - (Math.abs(Math.cos(rot)) * 1 + Math.abs(Math.sin(rot)) * 2),
      maxX: cx + (Math.abs(Math.cos(rot)) * 1 + Math.abs(Math.sin(rot)) * 2),
      minZ: cz - (Math.abs(Math.sin(rot)) * 1 + Math.abs(Math.cos(rot)) * 2),
      maxZ: cz + (Math.abs(Math.sin(rot)) * 1 + Math.abs(Math.cos(rot)) * 2),
    },
  }
}

export function createCity() {
  const root = new THREE.Group()
  const disposables = []
  const obstacles = []
  const cars = []
  const rng = mulberry32(42)

  const size = CITY_HALF * 2
  const groundGeo = new THREE.PlaneGeometry(size, size)
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x4a7a3a })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  root.add(ground)
  disposables.push(groundGeo, groundMat)

  const roadTex = makeRoadTexture()
  const sidewalkTex = makeSidewalkTexture()
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex })
  const sidewalkMat = new THREE.MeshLambertMaterial({ map: sidewalkTex })
  disposables.push(roadTex, sidewalkTex, roadMat, sidewalkMat)

  for (let i = -GRID_HALF; i <= GRID_HALF; i++) {
    const pos = i * BLOCK
    const hTex = roadTex.clone(); hTex.repeat.set(size / 10, 1); hTex.rotation = Math.PI / 2
    const hMat = new THREE.MeshLambertMaterial({ map: hTex })
    const hGeo = new THREE.PlaneGeometry(size, ROAD_WIDTH)
    const h = new THREE.Mesh(hGeo, hMat)
    h.rotation.x = -Math.PI / 2
    h.position.set(0, 0.01, pos)
    root.add(h)
    disposables.push(hGeo, hMat, hTex)

    const vTex = roadTex.clone(); vTex.repeat.set(1, size / 10)
    const vMat = new THREE.MeshLambertMaterial({ map: vTex })
    const vGeo = new THREE.PlaneGeometry(ROAD_WIDTH, size)
    const v = new THREE.Mesh(vGeo, vMat)
    v.rotation.x = -Math.PI / 2
    v.position.set(pos, 0.01, 0)
    root.add(v)
    disposables.push(vGeo, vMat, vTex)
  }

  const sidewalkW = 1.5
  for (let i = -GRID_HALF; i <= GRID_HALF; i++) {
    for (let j = -GRID_HALF; j <= GRID_HALF; j++) {
      const bx = i * BLOCK
      const bz = j * BLOCK
      if (i === GRID_HALF && j === GRID_HALF) continue
      if (i === GRID_HALF || j === GRID_HALF) continue

      const plotCx = bx + BLOCK / 2
      const plotCz = bz + BLOCK / 2
      const plotW = BLOCK - ROAD_WIDTH
      const plotD = BLOCK - ROAD_WIDTH

      const swTex1 = sidewalkTex.clone(); swTex1.repeat.set(plotW / 2, sidewalkW / 2)
      const swMat1 = new THREE.MeshLambertMaterial({ map: swTex1 })
      const swGeo1 = new THREE.PlaneGeometry(plotW + sidewalkW * 2, sidewalkW)
      for (const dz of [-plotD / 2 - sidewalkW / 2, plotD / 2 + sidewalkW / 2]) {
        const sw = new THREE.Mesh(swGeo1, swMat1)
        sw.rotation.x = -Math.PI / 2
        sw.position.set(plotCx, 0.02, plotCz + dz)
        root.add(sw)
      }
      disposables.push(swGeo1, swMat1, swTex1)

      const swTex2 = sidewalkTex.clone(); swTex2.repeat.set(sidewalkW / 2, plotD / 2)
      const swMat2 = new THREE.MeshLambertMaterial({ map: swTex2 })
      const swGeo2 = new THREE.PlaneGeometry(sidewalkW, plotD)
      for (const dx of [-plotW / 2 - sidewalkW / 2, plotW / 2 + sidewalkW / 2]) {
        const sw = new THREE.Mesh(swGeo2, swMat2)
        sw.rotation.x = -Math.PI / 2
        sw.position.set(plotCx + dx, 0.02, plotCz)
        root.add(sw)
      }
      disposables.push(swGeo2, swMat2, swTex2)

      const roll = rng()
      const buildings = []
      if (roll < 0.3) {
        buildings.push(buildHouse(rng, plotCx - plotW / 4, plotCz - plotD / 4, plotW / 2, plotD / 2))
        buildings.push(buildHouse(rng, plotCx + plotW / 4, plotCz - plotD / 4, plotW / 2, plotD / 2))
        buildings.push(buildHouse(rng, plotCx - plotW / 4, plotCz + plotD / 4, plotW / 2, plotD / 2))
        buildings.push(buildHouse(rng, plotCx + plotW / 4, plotCz + plotD / 4, plotW / 2, plotD / 2))
      } else if (roll < 0.65) {
        buildings.push(buildApartment(rng, plotCx, plotCz, plotW, plotD))
      } else if (roll < 0.85) {
        buildings.push(buildShop(rng, plotCx - plotW / 4, plotCz, plotW / 2, plotD))
        buildings.push(buildShop(rng, plotCx + plotW / 4, plotCz, plotW / 2, plotD))
      } else {
        buildings.push(buildApartment(rng, plotCx - plotW / 4, plotCz, plotW / 2, plotD))
        buildings.push(buildHouse(rng, plotCx + plotW / 4, plotCz, plotW / 2, plotD))
      }
      for (const b of buildings) {
        root.add(b.group)
        disposables.push(...b.disposables)
        if (b.obstacle) obstacles.push(b.obstacle)
      }

      for (let t = 0; t < 4; t++) {
        const side = Math.floor(rng() * 4)
        const along = -plotW / 2 + 3 + rng() * (plotW - 6)
        let tx, tz
        if (side === 0) { tx = plotCx + along; tz = plotCz - plotD / 2 - sidewalkW / 2 }
        else if (side === 1) { tx = plotCx + along; tz = plotCz + plotD / 2 + sidewalkW / 2 }
        else if (side === 2) { tx = plotCx - plotW / 2 - sidewalkW / 2; tz = plotCz + along }
        else { tx = plotCx + plotW / 2 + sidewalkW / 2; tz = plotCz + along }
        const tree = buildTree(tx, tz)
        root.add(tree.group)
        disposables.push(...tree.disposables)
        obstacles.push(tree.obstacle)
      }
    }
  }

  for (let i = -GRID_HALF; i < GRID_HALF; i++) {
    for (let j = -GRID_HALF; j < GRID_HALF; j++) {
      const x = i * BLOCK + BLOCK / 2
      const z = j * BLOCK + ROAD_WIDTH / 2 + 0.5
      if (rng() < 0.6) {
        const lamp = buildLamp(x - BLOCK / 2 + ROAD_WIDTH / 2 + 0.5, z)
        root.add(lamp.group)
        disposables.push(...lamp.disposables)
      }
    }
  }

  for (let i = 0; i < 8; i++) {
    const horizontal = rng() < 0.5
    const laneIdx = Math.floor(rng() * (GRID_HALF * 2)) - GRID_HALF
    const pos = laneIdx * BLOCK + (rng() - 0.5) * (BLOCK - ROAD_WIDTH - 4)
    const roadPos = (Math.floor(rng() * (GRID_HALF * 2 + 1)) - GRID_HALF) * BLOCK
    const cx = horizontal ? pos : roadPos + (rng() < 0.5 ? -1.5 : 1.5)
    const cz = horizontal ? roadPos + (rng() < 0.5 ? -1.5 : 1.5) : pos
    const rot = horizontal ? Math.PI / 2 : 0
    const car = buildCar(rng, cx, cz, rot)
    root.add(car.group)
    disposables.push(...car.disposables)
    const obstacle = car.obstacle
    obstacles.push(obstacle)
    cars.push({ group: car.group, obstacle, width: 2, length: 4 })
  }

  return { root, disposables, obstacles, cars }
}
