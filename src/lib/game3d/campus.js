import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three-stdlib'

export const CAMPUS_HALF = 120

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- Textures ---------------------------------------------------------------

function makeGrassTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#4a7a3a'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const v = 40 + Math.random() * 40
    ctx.fillStyle = `rgb(${v * 0.6},${v + 60},${v * 0.8})`
    ctx.fillRect(x, y, 1.2, 1.2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makePathTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#c9c3b0'
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 600; i++) {
    const v = 140 + Math.random() * 60
    ctx.fillStyle = `rgba(${v - 10},${v - 20},${v - 40},0.25)`
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1)
  }
  ctx.strokeStyle = '#9e9884'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeBrickTexture(tintRgb = [175, 75, 55]) {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')
  const [r, g, b] = tintRgb
  ctx.fillStyle = `rgb(${r - 20},${g - 20},${b - 20})`
  ctx.fillRect(0, 0, 256, 256)
  const bw = 32, bh = 16
  for (let y = 0; y < 256; y += bh) {
    const off = (y / bh) % 2 === 0 ? 0 : bw / 2
    for (let x = -bw; x < 256 + bw; x += bw) {
      const jitter = (Math.random() - 0.5) * 20
      ctx.fillStyle = `rgb(${Math.max(0, r + jitter) | 0},${Math.max(0, g + jitter) | 0},${Math.max(0, b + jitter) | 0})`
      ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeGlassTexture() {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')
  const grd = ctx.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, '#7fb8d4')
  grd.addColorStop(1, '#3e6a88')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = '#2a3f52'
  ctx.lineWidth = 3
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke()
  }
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeTrackTexture() {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#b04434'
  ctx.fillRect(0, 0, 512, 64)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  for (let y = 12; y <= 52; y += 10) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---- Building helpers -------------------------------------------------------

function addObstacle(obstacles, cx, cz, w, d) {
  obstacles.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 })
}

function buildLibrary(cx, cz, w, d, h, disp) {
  const group = new THREE.Group()
  const brickTex = makeBrickTexture([210, 200, 175])
  brickTex.repeat.set(w / 4, h / 3)
  const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.9 })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a4556, roughness: 0.7 })
  disp.push(brickTex, brickMat, roofMat)

  const bodyGeo = new RoundedBoxGeometry(w, h, d, 2, 0.4)
  const body = new THREE.Mesh(bodyGeo, brickMat)
  body.position.set(0, h / 2, 0)
  body.castShadow = true; body.receiveShadow = true
  group.add(body)
  disp.push(bodyGeo)

  // Columned portico
  const porticoW = w * 0.7
  const porticoD = 5
  const colCount = 6
  const colGeo = new THREE.CylinderGeometry(0.45, 0.5, h * 0.85, 16)
  const colMat = new THREE.MeshStandardMaterial({ color: 0xeae3d0, roughness: 0.8 })
  disp.push(colGeo, colMat)
  for (let i = 0; i < colCount; i++) {
    const t = i / (colCount - 1) - 0.5
    const col = new THREE.Mesh(colGeo, colMat)
    col.position.set(t * porticoW, h * 0.425, d / 2 + porticoD - 0.6)
    col.castShadow = true
    group.add(col)
  }

  // Pediment (triangle prism)
  const pedShape = new THREE.Shape()
  pedShape.moveTo(-porticoW / 2 - 0.6, 0)
  pedShape.lineTo(porticoW / 2 + 0.6, 0)
  pedShape.lineTo(0, 3)
  pedShape.lineTo(-porticoW / 2 - 0.6, 0)
  const pedGeo = new THREE.ExtrudeGeometry(pedShape, { depth: 0.6, bevelEnabled: false })
  const pediment = new THREE.Mesh(pedGeo, colMat)
  pediment.position.set(0, h * 0.88, d / 2 + porticoD - 0.3)
  pediment.castShadow = true
  group.add(pediment)
  disp.push(pedGeo)

  // Portico roof
  const porticoRoofGeo = new THREE.BoxGeometry(porticoW + 2, 0.6, porticoD)
  const porticoRoof = new THREE.Mesh(porticoRoofGeo, roofMat)
  porticoRoof.position.set(0, h * 0.85 + 0.3, d / 2 + porticoD / 2)
  group.add(porticoRoof)
  disp.push(porticoRoofGeo)

  // Dome on top
  const domeGeo = new THREE.SphereGeometry(w * 0.12, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2)
  const dome = new THREE.Mesh(domeGeo, new THREE.MeshStandardMaterial({ color: 0x6e8fa3, roughness: 0.5, metalness: 0.3 }))
  dome.position.set(0, h, 0)
  dome.castShadow = true
  group.add(dome)
  disp.push(domeGeo, dome.material)

  // Steps
  for (let i = 0; i < 4; i++) {
    const stepGeo = new THREE.BoxGeometry(porticoW + 4 - i * 0.5, 0.25, 0.8)
    const step = new THREE.Mesh(stepGeo, colMat)
    step.position.set(0, 0.125 + i * 0.25, d / 2 + porticoD + 1.5 - i * 0.4)
    step.receiveShadow = true
    group.add(step)
    disp.push(stepGeo)
  }

  group.position.set(cx, 0, cz)
  return group
}

function buildModernBuilding(cx, cz, w, d, h, disp, tintRgb = [180, 120, 90]) {
  const group = new THREE.Group()
  const brickTex = makeBrickTexture(tintRgb)
  brickTex.repeat.set(w / 5, h / 3)
  const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 })
  const glassTex = makeGlassTexture()
  glassTex.repeat.set(w / 6, h / 4)
  const glassMat = new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.25, metalness: 0.4 })
  disp.push(brickTex, brickMat, glassTex, glassMat)

  const bodyGeo = new RoundedBoxGeometry(w, h, d, 2, 0.25)
  const body = new THREE.Mesh(bodyGeo, brickMat)
  body.position.y = h / 2
  body.castShadow = true; body.receiveShadow = true
  group.add(body)
  disp.push(bodyGeo)

  // Glass facade stripes
  const stripeGeo = new THREE.BoxGeometry(w * 0.9, 1.2, 0.1)
  for (let i = 0; i < Math.floor(h / 3.2); i++) {
    const s1 = new THREE.Mesh(stripeGeo, glassMat)
    s1.position.set(0, 1.6 + i * 3.2, d / 2 + 0.05)
    group.add(s1)
    const s2 = new THREE.Mesh(stripeGeo, glassMat)
    s2.position.set(0, 1.6 + i * 3.2, -d / 2 - 0.05)
    group.add(s2)
  }
  disp.push(stripeGeo)

  // Roof cap
  const roofGeo = new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6)
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2f3b48, roughness: 0.8 })
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.position.y = h + 0.25
  roof.castShadow = true
  group.add(roof)
  disp.push(roofGeo, roofMat)

  group.position.set(cx, 0, cz)
  return group
}

function buildDorm(cx, cz, disp) {
  const w = 14, d = 10, h = 11
  const group = new THREE.Group()
  const brickTex = makeBrickTexture([165, 85, 65])
  brickTex.repeat.set(3, 2.5)
  const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.9 })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3a32, roughness: 0.8 })
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x2a4458, emissive: 0x1a2838, emissiveIntensity: 0.6 })
  disp.push(brickTex, brickMat, roofMat, windowMat)

  const bodyGeo = new RoundedBoxGeometry(w, h, d, 2, 0.15)
  const body = new THREE.Mesh(bodyGeo, brickMat)
  body.position.y = h / 2
  body.castShadow = true; body.receiveShadow = true
  group.add(body)
  disp.push(bodyGeo)

  // Sloped roof
  const roofShape = new THREE.Shape()
  roofShape.moveTo(-w / 2 - 0.4, 0)
  roofShape.lineTo(w / 2 + 0.4, 0)
  roofShape.lineTo(0, 3)
  roofShape.lineTo(-w / 2 - 0.4, 0)
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: d + 0.6, bevelEnabled: false })
  roofGeo.translate(0, 0, -(d + 0.6) / 2)
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.position.y = h
  roof.castShadow = true
  group.add(roof)
  disp.push(roofGeo)

  // Windows
  const winGeo = new THREE.BoxGeometry(1, 1.2, 0.08)
  disp.push(winGeo)
  for (let row = 0; row < 3; row++) {
    for (let col = -2; col <= 2; col++) {
      const w1 = new THREE.Mesh(winGeo, windowMat)
      w1.position.set(col * 2.5, 2 + row * 3, d / 2 + 0.05)
      group.add(w1)
      const w2 = new THREE.Mesh(winGeo, windowMat)
      w2.position.set(col * 2.5, 2 + row * 3, -d / 2 - 0.05)
      group.add(w2)
    }
  }

  // Door
  const doorGeo = new THREE.BoxGeometry(1.3, 2.2, 0.1)
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1f, roughness: 0.9 })
  const door = new THREE.Mesh(doorGeo, doorMat)
  door.position.set(0, 1.1, d / 2 + 0.05)
  group.add(door)
  disp.push(doorGeo, doorMat)

  group.position.set(cx, 0, cz)
  return group
}

function buildFountain(cx, cz, disp) {
  const group = new THREE.Group()
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcac2ad, roughness: 0.9 })
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3e8cb8,
    roughness: 0.15,
    metalness: 0.3,
    transparent: true,
    opacity: 0.85,
    emissive: 0x0f2f44,
    emissiveIntensity: 0.35,
  })
  disp.push(stoneMat, waterMat)

  const baseGeo = new THREE.CylinderGeometry(4.5, 5, 0.8, 32)
  const base = new THREE.Mesh(baseGeo, stoneMat)
  base.position.y = 0.4
  base.receiveShadow = true
  group.add(base)
  disp.push(baseGeo)

  const rimGeo = new THREE.TorusGeometry(4.5, 0.3, 10, 32)
  const rim = new THREE.Mesh(rimGeo, stoneMat)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.8
  group.add(rim)
  disp.push(rimGeo)

  const waterGeo = new THREE.CircleGeometry(4.4, 32)
  const water = new THREE.Mesh(waterGeo, waterMat)
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.75
  group.add(water)
  disp.push(waterGeo)

  // Central pillar
  const colGeo = new THREE.CylinderGeometry(0.5, 0.7, 2.5, 16)
  const col = new THREE.Mesh(colGeo, stoneMat)
  col.position.y = 2
  col.castShadow = true
  group.add(col)
  disp.push(colGeo)

  const topBowlGeo = new THREE.CylinderGeometry(1.4, 1.0, 0.4, 20)
  const topBowl = new THREE.Mesh(topBowlGeo, stoneMat)
  topBowl.position.y = 3.45
  topBowl.castShadow = true
  group.add(topBowl)
  disp.push(topBowlGeo)

  // Spout (animated column of water)
  const spoutGeo = new THREE.CylinderGeometry(0.15, 0.05, 1.5, 8)
  const spout = new THREE.Mesh(spoutGeo, waterMat)
  spout.position.y = 4.4
  group.add(spout)
  disp.push(spoutGeo)

  group.position.set(cx, 0, cz)
  group.userData.spout = spout
  return group
}

function buildTree(cx, cz, disp, rng) {
  const group = new THREE.Group()
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.5, 8)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b24, roughness: 0.9 })
  const trunk = new THREE.Mesh(trunkGeo, trunkMat)
  trunk.position.y = 1.25
  trunk.castShadow = true
  group.add(trunk)
  const foliageGeo = new THREE.IcosahedronGeometry(1.6 + rng() * 0.4, 1)
  const foliageMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.28 + rng() * 0.05, 0.55, 0.38),
    roughness: 0.85,
    flatShading: true,
  })
  const foliage = new THREE.Mesh(foliageGeo, foliageMat)
  foliage.position.y = 3.2
  foliage.castShadow = true
  group.add(foliage)
  disp.push(trunkGeo, trunkMat, foliageGeo, foliageMat)
  group.position.set(cx, 0, cz)
  group.rotation.y = rng() * Math.PI * 2
  return group
}

function buildLamp(cx, cz, disp) {
  const group = new THREE.Group()
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8)
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.8 })
  const pole = new THREE.Mesh(poleGeo, poleMat)
  pole.position.y = 2.25
  group.add(pole)
  const bulbGeo = new THREE.SphereGeometry(0.25, 12, 8)
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c0, emissive: 0xffe090, emissiveIntensity: 1.2,
  })
  const bulb = new THREE.Mesh(bulbGeo, bulbMat)
  bulb.position.y = 4.5
  group.add(bulb)
  disp.push(poleGeo, poleMat, bulbGeo, bulbMat)
  group.position.set(cx, 0, cz)
  return group
}

function buildBench(cx, cz, rot, disp) {
  const group = new THREE.Group()
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 })
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6, metalness: 0.5 })
  disp.push(woodMat, metalMat)

  const seatGeo = new THREE.BoxGeometry(2.4, 0.12, 0.55)
  const seat = new THREE.Mesh(seatGeo, woodMat)
  seat.position.y = 0.55
  seat.castShadow = true
  group.add(seat)

  const backGeo = new THREE.BoxGeometry(2.4, 0.7, 0.1)
  const back = new THREE.Mesh(backGeo, woodMat)
  back.position.set(0, 0.95, -0.22)
  group.add(back)

  const legGeo = new THREE.BoxGeometry(0.12, 0.55, 0.55)
  for (const x of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, metalMat)
    leg.position.set(x, 0.27, 0)
    group.add(leg)
  }
  disp.push(seatGeo, backGeo, legGeo)

  group.position.set(cx, 0, cz)
  group.rotation.y = rot
  return group
}

function buildCar(rng, cx, cz, rot, disp) {
  const group = new THREE.Group()
  const colors = [0xd93f3f, 0x2f6fd0, 0xf2d149, 0x2a2a2a, 0xe8e8e8, 0x2ea35a]
  const bodyMat = new THREE.MeshStandardMaterial({ color: colors[Math.floor(rng() * colors.length)], roughness: 0.45, metalness: 0.5 })
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.3, metalness: 0.7 })
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.9 })
  disp.push(bodyMat, cabinMat, wheelMat)

  const bodyGeo = new RoundedBoxGeometry(2, 0.7, 4, 2, 0.2)
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.set(0, 0.75, 0)
  body.castShadow = true
  group.add(body)
  const cabinGeo = new RoundedBoxGeometry(1.8, 0.7, 2, 2, 0.15)
  const cabin = new THREE.Mesh(cabinGeo, cabinMat)
  cabin.position.set(0, 1.4, -0.2)
  cabin.castShadow = true
  group.add(cabin)
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12)
  wheelGeo.rotateZ(Math.PI / 2)
  for (const [x, z] of [[-0.9, -1.3], [0.9, -1.3], [-0.9, 1.3], [0.9, 1.3]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat)
    w.position.set(x, 0.35, z)
    group.add(w)
  }
  disp.push(bodyGeo, cabinGeo, wheelGeo)
  group.position.set(cx, 0, cz)
  group.rotation.y = rot
  const cosA = Math.abs(Math.cos(rot)), sinA = Math.abs(Math.sin(rot))
  return {
    group,
    obstacle: {
      minX: cx - (cosA * 1 + sinA * 2),
      maxX: cx + (cosA * 1 + sinA * 2),
      minZ: cz - (sinA * 1 + cosA * 2),
      maxZ: cz + (sinA * 1 + cosA * 2),
    },
  }
}

function buildBike(rng, cx, cz, rot, disp) {
  const group = new THREE.Group()
  const colors = [0xe74c3c, 0x1abc9c, 0xf1c40f, 0x9b59b6, 0x34495e, 0xe67e22]
  const frameMat = new THREE.MeshStandardMaterial({
    color: colors[Math.floor(rng() * colors.length)],
    roughness: 0.35, metalness: 0.75,
  })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 })
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.2, metalness: 0.95 })
  disp.push(frameMat, darkMat, chromeMat)

  // Roues (verticales sur l'axe X)
  const wheelGeo = new THREE.TorusGeometry(0.4, 0.07, 8, 24)
  disp.push(wheelGeo)
  const wheelFront = new THREE.Mesh(wheelGeo, darkMat)
  wheelFront.rotation.y = Math.PI / 2
  wheelFront.position.set(0, 0.4, 0.9)
  wheelFront.castShadow = true
  group.add(wheelFront)
  const wheelRear = new THREE.Mesh(wheelGeo, darkMat)
  wheelRear.rotation.y = Math.PI / 2
  wheelRear.position.set(0, 0.4, -0.9)
  wheelRear.castShadow = true
  group.add(wheelRear)

  // Jantes (cercles int&eacute;rieurs)
  const rimGeo = new THREE.TorusGeometry(0.3, 0.03, 6, 18)
  disp.push(rimGeo)
  const rimF = new THREE.Mesh(rimGeo, chromeMat)
  rimF.rotation.y = Math.PI / 2
  rimF.position.copy(wheelFront.position)
  group.add(rimF)
  const rimR = new THREE.Mesh(rimGeo, chromeMat)
  rimR.rotation.y = Math.PI / 2
  rimR.position.copy(wheelRear.position)
  group.add(rimR)

  // Cadre (tube principal diagonal)
  const frameGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8)
  disp.push(frameGeo)
  const topTube = new THREE.Mesh(frameGeo, frameMat)
  topTube.rotation.x = Math.PI / 2
  topTube.position.set(0, 0.85, 0)
  topTube.castShadow = true
  group.add(topTube)
  // Tube de selle
  const seatTube = new THREE.Mesh(frameGeo, frameMat)
  seatTube.position.set(0, 0.75, -0.6)
  seatTube.scale.y = 0.6
  group.add(seatTube)
  // Fourche avant
  const forkTube = new THREE.Mesh(frameGeo, frameMat)
  forkTube.position.set(0, 0.75, 0.8)
  forkTube.scale.y = 0.65
  group.add(forkTube)

  // Selle
  const seatGeo = new THREE.BoxGeometry(0.18, 0.08, 0.35)
  disp.push(seatGeo)
  const seat = new THREE.Mesh(seatGeo, darkMat)
  seat.position.set(0, 1.1, -0.6)
  seat.castShadow = true
  group.add(seat)

  // Guidon
  const barGeo = new THREE.BoxGeometry(0.55, 0.06, 0.06)
  disp.push(barGeo)
  const bar = new THREE.Mesh(barGeo, darkMat)
  bar.position.set(0, 1.15, 0.85)
  group.add(bar)
  // Tige du guidon
  const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6)
  disp.push(stemGeo)
  const stem = new THREE.Mesh(stemGeo, chromeMat)
  stem.position.set(0, 1.0, 0.85)
  group.add(stem)

  // P&eacute;daliers
  const pedalGeo = new THREE.BoxGeometry(0.25, 0.04, 0.04)
  disp.push(pedalGeo)
  for (const px of [-0.12, 0.12]) {
    const pedal = new THREE.Mesh(pedalGeo, chromeMat)
    pedal.position.set(px, 0.35, -0.1)
    group.add(pedal)
  }

  group.position.set(cx, 0, cz)
  group.rotation.y = rot
  const cosA = Math.abs(Math.cos(rot)), sinA = Math.abs(Math.sin(rot))
  return {
    group,
    obstacle: {
      minX: cx - (cosA * 0.4 + sinA * 1.1),
      maxX: cx + (cosA * 0.4 + sinA * 1.1),
      minZ: cz - (sinA * 0.4 + cosA * 1.1),
      maxZ: cz + (sinA * 0.4 + cosA * 1.1),
    },
  }
}

// ---- Main ------------------------------------------------------------------

export function createCampus() {
  const root = new THREE.Group()
  const disposables = []
  const obstacles = []
  const cars = []
  const rng = mulberry32(2025)

  const size = CAMPUS_HALF * 2

  // Grass ground
  const grassTex = makeGrassTexture()
  grassTex.repeat.set(size / 8, size / 8)
  const groundGeo = new THREE.PlaneGeometry(size, size)
  const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  root.add(ground)
  disposables.push(grassTex, groundGeo, groundMat)

  // Path texture
  const pathTex = makePathTexture()
  const pathMat = new THREE.MeshStandardMaterial({ map: pathTex, roughness: 1 })
  disposables.push(pathTex, pathMat)

  // Main paths — X pattern from fountain
  const addPath = (w, l, x, z, rot = 0) => {
    const tex = pathTex.clone()
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(w / 2.5, l / 2.5)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
    disposables.push(tex, mat)
    const geo = new THREE.PlaneGeometry(w, l)
    const m = new THREE.Mesh(geo, mat)
    m.rotation.x = -Math.PI / 2
    m.rotation.z = rot
    m.position.set(x, 0.02, z)
    m.receiveShadow = true
    root.add(m)
    disposables.push(geo)
  }
  addPath(6, size - 30, 0, 0) // N-S
  addPath(size - 30, 6, 0, 0, Math.PI / 2) // E-W

  // Central plaza
  const plazaGeo = new THREE.CircleGeometry(14, 48)
  const plazaMat = new THREE.MeshStandardMaterial({ map: pathTex.clone(), roughness: 1 })
  plazaMat.map.wrapS = plazaMat.map.wrapT = THREE.RepeatWrapping
  plazaMat.map.repeat.set(5, 5)
  plazaMat.map.colorSpace = THREE.SRGBColorSpace
  const plaza = new THREE.Mesh(plazaGeo, plazaMat)
  plaza.rotation.x = -Math.PI / 2
  plaza.position.y = 0.03
  plaza.receiveShadow = true
  root.add(plaza)
  disposables.push(plazaGeo, plazaMat, plazaMat.map)

  // Fountain
  const fountain = buildFountain(0, 0, disposables)
  root.add(fountain)
  addObstacle(obstacles, 0, 0, 10, 10)
  root.userData.fountain = fountain

  // Library (north)
  const libW = 38, libD = 16, libH = 14
  const library = buildLibrary(0, -52, libW, libD, libH, disposables)
  root.add(library)
  addObstacle(obstacles, 0, -52, libW, libD + 10) // +10 for portico

  // Science building (east)
  const sci = buildModernBuilding(52, 0, 18, 26, 16, disposables, [180, 190, 200])
  sci.rotation.y = Math.PI / 2
  root.add(sci)
  addObstacle(obstacles, 52, 0, 26, 18)

  // Arts building (west)
  const arts = buildModernBuilding(-52, 0, 18, 26, 13, disposables, [210, 140, 95])
  arts.rotation.y = -Math.PI / 2
  root.add(arts)
  addObstacle(obstacles, -52, 0, 26, 18)

  // Dormitories (south)
  const dormPositions = [[-28, 55], [0, 58], [28, 55]]
  for (const [x, z] of dormPositions) {
    root.add(buildDorm(x, z, disposables))
    addObstacle(obstacles, x, z, 14, 10)
  }

  // Lecture halls (corners)
  const lectureSpots = [[-60, -60], [60, -60]]
  for (const [x, z] of lectureSpots) {
    const b = buildModernBuilding(x, z, 16, 16, 9, disposables, [200, 180, 150])
    root.add(b)
    addObstacle(obstacles, x, z, 16, 16)
  }

  // Stadium (SW)
  const sx = -70, sz = 75
  const trackTex = makeTrackTexture()
  trackTex.repeat.set(8, 1)
  const trackMat = new THREE.MeshStandardMaterial({ map: trackTex, roughness: 0.95 })
  disposables.push(trackTex, trackMat)
  const trackGeo = new THREE.RingGeometry(10, 17, 48)
  const track = new THREE.Mesh(trackGeo, trackMat)
  track.rotation.x = -Math.PI / 2
  track.position.set(sx, 0.04, sz)
  track.receiveShadow = true
  root.add(track)
  disposables.push(trackGeo)

  const fieldGeo = new THREE.CircleGeometry(10, 32)
  const fieldMat = new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 1 })
  const field = new THREE.Mesh(fieldGeo, fieldMat)
  field.rotation.x = -Math.PI / 2
  field.position.set(sx, 0.03, sz)
  field.receiveShadow = true
  root.add(field)
  disposables.push(fieldGeo, fieldMat)

  // Goals
  const goalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })
  disposables.push(goalMat)
  const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.5, 6)
  const barGeo = new THREE.CylinderGeometry(0.1, 0.1, 6, 6)
  barGeo.rotateZ(Math.PI / 2)
  disposables.push(postGeo, barGeo)
  for (const dz of [-8, 8]) {
    for (const px of [-3, 3]) {
      const p = new THREE.Mesh(postGeo, goalMat)
      p.position.set(sx + px, 1.25, sz + dz)
      root.add(p)
    }
    const bar = new THREE.Mesh(barGeo, goalMat)
    bar.position.set(sx, 2.5, sz + dz)
    root.add(bar)
  }

  // Parking lot (SE) with cars
  const parkTex = makePathTexture()
  parkTex.repeat.set(6, 6)
  const parkMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: 0.95 })
  disposables.push(parkTex, parkMat)
  const parkGeo = new THREE.PlaneGeometry(40, 30)
  const park = new THREE.Mesh(parkGeo, parkMat)
  park.rotation.x = -Math.PI / 2
  park.position.set(70, 0.04, 70)
  park.receiveShadow = true
  root.add(park)
  disposables.push(parkGeo)

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      if (rng() < 0.25) continue
      const cx = 70 - 16 + col * 7
      const cz = 70 - 10 + row * 10
      const car = buildCar(rng, cx, cz, 0, disposables)
      root.add(car.group)
      obstacles.push(car.obstacle)
      cars.push({ group: car.group, obstacle: car.obstacle, width: 2, length: 4 })
    }
  }

  // Street cars near buildings (drivable)
  for (const [x, z, rot] of [[-28, -30, 0], [28, -30, 0], [-30, 35, Math.PI / 2], [30, 35, Math.PI / 2]]) {
    const car = buildCar(rng, x, z, rot, disposables)
    root.add(car.group)
    obstacles.push(car.obstacle)
    cars.push({ group: car.group, obstacle: car.obstacle, width: 2, length: 4 })
  }

  // Bike rack — on the SE path toward the parkour entrance
  for (const [x, z, rot] of [
    [50, 60, Math.PI / 2],
    [50, 62.5, Math.PI / 2],
    [50, 65, Math.PI / 2],
    [50, 67.5, Math.PI / 2],
    // Bike near fountain
    [8, 12, 0],
    [-8, 12, 0],
    // Bike near library
    [0, -38, Math.PI],
    // Extras scattered
    [-45, 20, Math.PI / 4],
    [60, -10, -Math.PI / 3],
  ]) {
    const bike = buildBike(rng, x, z, rot, disposables)
    root.add(bike.group)
    obstacles.push(bike.obstacle)
    cars.push({
      group: bike.group, obstacle: bike.obstacle,
      width: 0.8, length: 2, vehicleType: 'bike',
    })
  }

  // Trees — scatter but avoid obstacles
  const treeTries = 120
  let placed = 0
  for (let i = 0; i < treeTries && placed < 70; i++) {
    const x = (rng() - 0.5) * 2 * (CAMPUS_HALF - 5)
    const z = (rng() - 0.5) * 2 * (CAMPUS_HALF - 5)
    // keep trees off main paths
    if (Math.abs(x) < 4 || Math.abs(z) < 4) continue
    if (Math.hypot(x, z) < 18) continue
    let blocked = false
    for (const o of obstacles) {
      if (x + 1.2 > o.minX - 2 && x - 1.2 < o.maxX + 2 && z + 1.2 > o.minZ - 2 && z - 1.2 < o.maxZ + 2) {
        blocked = true; break
      }
    }
    if (blocked) continue
    root.add(buildTree(x, z, disposables, rng))
    obstacles.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8 })
    placed++
  }

  // Lamps along main paths
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue
    root.add(buildLamp(i * 12, 4, disposables))
    root.add(buildLamp(i * 12, -4, disposables))
    root.add(buildLamp(4, i * 12, disposables))
    root.add(buildLamp(-4, i * 12, disposables))
  }

  // Benches around fountain
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const r = 11
    const bx = Math.cos(a) * r
    const bz = Math.sin(a) * r
    root.add(buildBench(bx, bz, a + Math.PI / 2, disposables))
  }

  // Boundary walls (low fences to contain movement visually)
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x8b8577, roughness: 0.9 })
  disposables.push(fenceMat)
  const fenceGeo = new THREE.BoxGeometry(size, 1.2, 0.3)
  disposables.push(fenceGeo)
  for (const [rot, z] of [[0, -CAMPUS_HALF + 1], [0, CAMPUS_HALF - 1]]) {
    const f = new THREE.Mesh(fenceGeo, fenceMat)
    f.position.set(0, 0.6, z)
    f.rotation.y = rot
    root.add(f)
  }
  const fenceGeo2 = new THREE.BoxGeometry(0.3, 1.2, size)
  disposables.push(fenceGeo2)
  for (const x of [-CAMPUS_HALF + 1, CAMPUS_HALF - 1]) {
    const f = new THREE.Mesh(fenceGeo2, fenceMat)
    f.position.set(x, 0.6, 0)
    root.add(f)
  }

  // Animated fountain spout
  root.userData.animate = (t) => {
    if (fountain.userData.spout) {
      const s = fountain.userData.spout
      s.scale.y = 1 + Math.sin(t * 4) * 0.12
      s.position.y = 4.4 + Math.sin(t * 4) * 0.08
    }
  }

  return { root, disposables, obstacles, cars }
}
