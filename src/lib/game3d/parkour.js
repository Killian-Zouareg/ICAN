import * as THREE from 'three'

// ============================================================================
//  iPARKOUR — Tour de parkour INSANE int&eacute;gr&eacute;e au Hub 3D
// ============================================================================

const TYPES = {
  NORMAL: 'normal',
  ICE: 'ice',
  SLIME: 'slime',
  MOVING: 'moving',
  PHASE: 'phase',   // plateforme qui appara&icirc;t/dispara&icirc;t
}

const COLORS = {
  normal: 0x6a7380,
  ice: 0x9ed6f5,
  slime: 0x7fdb5f,
  moving: 0xc27a2a,
  phase: 0xa855f7,
}

function aabb(cx, cy, cz, w, h, d) {
  return {
    minX: cx - w / 2, maxX: cx + w / 2,
    minY: cy - h / 2, maxY: cy + h / 2,
    minZ: cz - d / 2, maxZ: cz + d / 2,
  }
}

function formatLbTime(ms) {
  const s = ms / 1000
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`
}

export function createParkour({ origin = new THREE.Vector3(95, 0, 95) } = {}) {
  const root = new THREE.Group()
  root.position.copy(origin)

  const platforms = []
  const hazards = []
  const checkpoints = []
  const disposables = []
  const movers = []
  const phasers = []

  // Materials
  const mats = {}
  for (const [k, hex] of Object.entries(COLORS)) {
    mats[k] = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: k === 'ice' ? 0.15 : k === 'slime' ? 0.6 : 0.8,
      metalness: k === 'ice' ? 0.3 : 0.05,
      transparent: k === 'ice' || k === 'phase',
      opacity: k === 'ice' ? 0.78 : k === 'phase' ? 0.95 : 1,
      emissive: k === 'phase' ? 0x4a0060 : 0x000000,
      emissiveIntensity: k === 'phase' ? 0.5 : 0,
    })
    disposables.push(mats[k])
  }
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x554400, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.6 })
  const grayMat = new THREE.MeshStandardMaterial({ color: 0x555a66, roughness: 0.9 })
  const lavaMat = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff2200, emissiveIntensity: 1.2, roughness: 0.6 })
  disposables.push(goldMat, grayMat, lavaMat)

  function addPlatform(cx, cy, cz, w, h, d, type = TYPES.NORMAL, extra = null) {
    const geo = new THREE.BoxGeometry(w, h, d)
    disposables.push(geo)
    const mesh = new THREE.Mesh(geo, mats[type] || mats.normal)
    mesh.position.set(cx, cy, cz)
    mesh.castShadow = true
    mesh.receiveShadow = true
    root.add(mesh)
    const box = { ...aabb(cx, cy, cz, w, h, d), type, mesh, w, h, d, _inactive: false }
    if (extra) Object.assign(box, extra)
    platforms.push(box)
    if (type === TYPES.MOVING && extra) movers.push(box)
    if (type === TYPES.PHASE) phasers.push(box)
    return box
  }

  function addHazard(cx, cy, cz, w, h, d) {
    const geo = new THREE.BoxGeometry(w, h, d)
    disposables.push(geo)
    const m = new THREE.Mesh(geo, lavaMat)
    m.position.set(cx, cy, cz)
    root.add(m)
    hazards.push(aabb(cx, cy, cz, w, h, d))
  }

  // ---- Pit de lave ----
  const PIT_W = 100, PIT_D = 80
  {
    const geo = new THREE.BoxGeometry(PIT_W, 0.4, PIT_D)
    disposables.push(geo)
    const lava = new THREE.Mesh(geo, lavaMat)
    lava.position.set(20, -0.6, 0)
    lava.receiveShadow = true
    root.add(lava)
    hazards.push({
      minX: 20 - PIT_W / 2, maxX: 20 + PIT_W / 2,
      minY: -2, maxY: 0.2,
      minZ: -PIT_D / 2, maxZ: PIT_D / 2,
    })
    const borderGeo = new THREE.BoxGeometry(PIT_W + 4, 1, PIT_D + 4)
    disposables.push(borderGeo)
    const border = new THREE.Mesh(borderGeo, grayMat)
    border.position.set(20, -0.8, 0)
    border.receiveShadow = true
    root.add(border)
  }

  // ---- Plateforme de d&eacute;part ----
  const startX = -35
  const startZ = 0
  addPlatform(startX, 0.2, startZ, 8, 0.4, 8, TYPES.NORMAL)

  // ---- Entr&eacute;e monumentale (arche + chemin + torches) ----
  buildParkourEntrance(root, disposables, startX, startZ)

  const spawnPoint = new THREE.Vector3(origin.x + startX, 0.4, origin.z + startZ)
  const cp0Mesh = makeCheckpointFlag(root, startX + 2, 0.4, startZ - 3, disposables)
  checkpoints.push({ index: 0, pos: spawnPoint.clone(), mesh: cp0Mesh, reached: true })

  // ============================================================================
  // SECTION 1 : 8 neo-jumps, plateformes 0.9x0.9, gaps serpentins
  // ============================================================================
  let x = startX + 4
  let y = 1.0
  let z = 0
  const s1 = [
    { dx: 3.0, dz: 0,    dy: 0.3 },
    { dx: 2.8, dz: 1.5,  dy: 0.4 },
    { dx: 3.1, dz: -1.8, dy: 0.5 },
    { dx: 3.2, dz: 1.2,  dy: 0.3 },
    { dx: 2.9, dz: -1.6, dy: 0.5 },
    { dx: 3.3, dz: 2.0,  dy: 0.4 },
    { dx: 3.0, dz: -1.5, dy: 0.5 },
    { dx: 3.1, dz: 0.8,  dy: 0.3 },
  ]
  for (const s of s1) {
    x += s.dx; y += s.dy; z += s.dz
    addPlatform(x, y, z, 0.9, 0.6, 0.9, TYPES.NORMAL)
  }

  // Checkpoint 1
  x += 2.8
  z = 0
  addPlatform(x, y, z, 3, 0.4, 3, TYPES.NORMAL)
  checkpoints.push({
    index: 1,
    pos: new THREE.Vector3(origin.x + x, origin.y + y + 0.4, origin.z + z),
    mesh: makeCheckpointFlag(root, x, y + 0.3, z - 1.3, disposables),
    reached: false,
  })

  // ============================================================================
  // SECTION 2 : double rail de glace (courb&eacute; en Z, bord tranchant)
  // ============================================================================
  x += 4
  addPlatform(x, y, 0, 7, 0.3, 1.0, TYPES.ICE) // rail long et &eacute;troit
  // pit between rails (visible fall)
  x += 6
  addPlatform(x + 1, y, -2.5, 5, 0.3, 1.0, TYPES.ICE) // rail d&eacute;cal&eacute;
  x += 5
  addPlatform(x, y - 0.2, -2.5, 1, 0.5, 1, TYPES.NORMAL)
  x += 2.6
  addPlatform(x, y, -2.5, 1, 0.5, 1, TYPES.NORMAL)
  x += 2.9
  addPlatform(x, y + 0.3, -2.5, 1, 0.5, 1, TYPES.NORMAL)

  // ============================================================================
  // SECTION 3 : tunnel de head-hitters (5 plafonds successifs)
  // ============================================================================
  x += 3
  y += 0.5
  const floorLen = 14
  // floor
  addPlatform(x + floorLen / 2 - 1, y, -2.5, floorLen, 0.4, 2, TYPES.NORMAL)
  // 5 plafonds bas
  for (let i = 0; i < 5; i++) {
    const cx = x + 1.2 + i * 2.6
    addPlatform(cx, y + 1.95, -2.5, 1.5, 0.4, 2.2, TYPES.NORMAL)
  }
  x += floorLen - 1

  // Checkpoint 2
  x += 3
  addPlatform(x, y, -2.5, 3, 0.4, 3, TYPES.NORMAL)
  checkpoints.push({
    index: 2,
    pos: new THREE.Vector3(origin.x + x, origin.y + y + 0.4, origin.z - 2.5),
    mesh: makeCheckpointFlag(root, x, y + 0.3, -3.8, disposables),
    reached: false,
  })

  // ============================================================================
  // SECTION 4 : cha&icirc;ne de 3 slimes (3 rebonds obligatoires, pr&eacute;cision accrue)
  // ============================================================================
  x += 3.5
  addPlatform(x, y - 0.3, -2.5, 1.6, 0.4, 1.6, TYPES.SLIME)
  // Retomb&eacute;e sur seconde slime
  x += 4.5
  addPlatform(x, y + 2.5, -2.5, 1.6, 0.4, 1.6, TYPES.SLIME)
  // 3e slime
  x += 5
  addPlatform(x, y + 5, -2.5, 1.4, 0.4, 1.4, TYPES.SLIME)
  // Atterrissage tout en haut
  x += 5
  y += 9
  addPlatform(x, y, -2.5, 2, 0.4, 2, TYPES.NORMAL)

  // ============================================================================
  // SECTION 5 : 5 plateformes mobiles synchronis&eacute;es
  // ============================================================================
  x += 4
  // Mobile X rapide
  addPlatform(x, y, -2.5, 1.2, 0.4, 1.2, TYPES.MOVING, {
    axis: 'x', v0: x, v1: x + 4, speed: 2.2, phase: 0,
  })
  x += 6.5
  // Ilot
  addPlatform(x, y, -2.5, 1, 0.4, 1, TYPES.NORMAL)
  x += 3
  // Mobile Z oscillant
  addPlatform(x, y, -2.5, 1.2, 0.4, 1.2, TYPES.MOVING, {
    axis: 'z', v0: -4, v1: -1, speed: 2.0, phase: 1.5,
  })
  x += 4
  addPlatform(x, y, -2.5, 1, 0.4, 1, TYPES.NORMAL)
  x += 3
  // Ascenseur vertical rapide
  addPlatform(x, y + 1, -2.5, 1.3, 0.4, 1.3, TYPES.MOVING, {
    axis: 'y', v0: y, v1: y + 5, speed: 1.2, phase: 3.0,
  })
  x += 3
  y += 4
  addPlatform(x, y, -2.5, 1.3, 0.4, 1.3, TYPES.NORMAL)
  x += 3.5
  // 4e mobile: diagonal rapide sur X
  addPlatform(x, y, -2.5, 1.1, 0.4, 1.1, TYPES.MOVING, {
    axis: 'x', v0: x - 1, v1: x + 3, speed: 2.8, phase: 2.0,
  })
  x += 5
  addPlatform(x, y, -2.5, 1.3, 0.4, 1.3, TYPES.NORMAL)

  // Checkpoint 3
  x += 3
  addPlatform(x, y, -2.5, 3, 0.4, 3, TYPES.NORMAL)
  checkpoints.push({
    index: 3,
    pos: new THREE.Vector3(origin.x + x, origin.y + y + 0.4, origin.z - 2.5),
    mesh: makeCheckpointFlag(root, x, y + 0.3, -3.8, disposables),
    reached: false,
  })

  // ============================================================================
  // SECTION 6 : plateformes qui disparaissent (6 blocs, timing d&eacute;cal&eacute;)
  // ============================================================================
  x += 4
  for (let i = 0; i < 6; i++) {
    // Alternance : deux groupes (pairs/impairs) avec phases oppos&eacute;es
    const groupPhase = (i % 2) * Math.PI
    addPlatform(x, y, -2.5 + (i % 2 ? 0.5 : -0.5), 1, 0.4, 1, TYPES.PHASE, {
      period: 2.4, phase: groupPhase, dutyCycle: 0.55,
    })
    x += 2.6
  }

  // ============================================================================
  // SECTION 7 : spirale ascendante de micro-plateformes (10 blocs)
  // ============================================================================
  x += 2.5
  addPlatform(x, y, -2.5, 1.3, 0.4, 1.3, TYPES.NORMAL)
  const spiralCenterX = x + 4
  const spiralCenterZ = -2.5
  for (let i = 0; i < 10; i++) {
    const angle = i * 0.65
    const radius = 3.2
    const sx = spiralCenterX + Math.cos(angle) * radius
    const sz = spiralCenterZ + Math.sin(angle) * radius
    const sy = y + 0.7 + i * 0.9
    addPlatform(sx, sy, sz, 0.9, 0.4, 0.9, i % 3 === 0 ? TYPES.ICE : TYPES.NORMAL)
  }
  x = spiralCenterX + 4
  y += 0.7 + 9 * 0.9 // ~8.8m gagn&eacute;s
  addPlatform(x, y, spiralCenterZ, 2.5, 0.4, 2.5, TYPES.NORMAL)

  // Checkpoint 4
  checkpoints.push({
    index: 4,
    pos: new THREE.Vector3(origin.x + x, origin.y + y + 0.4, origin.z + spiralCenterZ),
    mesh: makeCheckpointFlag(root, x, y + 0.3, spiralCenterZ - 1.3, disposables),
    reached: false,
  })

  // ============================================================================
  // SECTION 8 : gauntlet final - glace + slime + saut momentum long
  // ============================================================================
  x += 3.5
  // Rail de glace tr&egrave;s fin
  addPlatform(x, y, spiralCenterZ, 6, 0.3, 0.8, TYPES.ICE)
  x += 5
  // Micro-pavement normal
  addPlatform(x, y, spiralCenterZ, 0.8, 0.4, 0.8, TYPES.NORMAL)
  x += 3.2
  // Slime final (grand boost)
  addPlatform(x, y - 0.4, spiralCenterZ, 1.5, 0.4, 1.5, TYPES.SLIME)
  // Atterrissage tr&egrave;s haut
  x += 5
  addPlatform(x, y + 6, spiralCenterZ, 1.1, 0.4, 1.1, TYPES.NORMAL)
  x += 2.5
  addPlatform(x, y + 6.5, spiralCenterZ, 1.0, 0.4, 1.0, TYPES.NORMAL)
  x += 2.5
  addPlatform(x, y + 7, spiralCenterZ, 1.1, 0.4, 1.1, TYPES.NORMAL)
  x += 2.5
  addPlatform(x, y + 7.2, spiralCenterZ, 1.0, 0.4, 1.0, TYPES.NORMAL)
  y += 7.2

  // ============================================================================
  // GOAL : tour finale dor&eacute;e
  // ============================================================================
  x += 3.5
  const goalY = y + 1.2
  addPlatform(x, goalY - 0.3, spiralCenterZ, 6, 0.6, 6, TYPES.NORMAL)
  const goalGeo = new THREE.CylinderGeometry(1.2, 1.2, 3.5, 20)
  disposables.push(goalGeo)
  const goalMesh = new THREE.Mesh(goalGeo, goldMat)
  goalMesh.position.set(x, goalY + 1.8, spiralCenterZ)
  goalMesh.castShadow = true
  root.add(goalMesh)
  // Pilier lumineux g&eacute;ant
  const beamGeo = new THREE.CylinderGeometry(0.5, 0.5, 80, 12, 1, true)
  disposables.push(beamGeo)
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  disposables.push(beamMat)
  const beam = new THREE.Mesh(beamGeo, beamMat)
  beam.position.set(x, goalY + 40, spiralCenterZ)
  root.add(beam)

  const goal = {
    pos: new THREE.Vector3(origin.x + x, origin.y + goalY + 2, origin.z + spiralCenterZ),
    mesh: goalMesh,
    _worldAabb: {
      minX: origin.x + x - 1.5, maxX: origin.x + x + 1.5,
      minY: origin.y + goalY, maxY: origin.y + goalY + 3.5,
      minZ: origin.z + spiralCenterZ - 1.5, maxZ: origin.z + spiralCenterZ + 1.5,
    },
  }

  // ============================================================================
  // Conversion locale -> monde pour la collision
  // ============================================================================
  const worldPlatforms = platforms.map((p) => ({
    ...p,
    minX: p.minX + origin.x, maxX: p.maxX + origin.x,
    minY: p.minY + origin.y, maxY: p.maxY + origin.y,
    minZ: p.minZ + origin.z, maxZ: p.maxZ + origin.z,
  }))
  const worldHazards = hazards.map((h) => ({
    minX: h.minX + origin.x, maxX: h.maxX + origin.x,
    minY: h.minY + origin.y, maxY: h.maxY + origin.y,
    minZ: h.minZ + origin.z, maxZ: h.maxZ + origin.z,
  }))

  // ============================================================================
  // LEADERBOARD BILLBOARD (panneau 3D visible depuis le spawn)
  // ============================================================================
  const billboard = createLeaderboardBillboard(root, disposables, startX, startZ)

  // ============================================================================
  // Animation (plateformes mobiles + plateformes qui disparaissent)
  // ============================================================================
  function animate(t) {
    // Movers
    for (const m of movers) {
      const u = (Math.sin(t * m.speed + (m.phase || 0)) + 1) / 2
      const val = m.v0 + (m.v1 - m.v0) * u
      let dx = 0, dy = 0, dz = 0
      if (m.axis === 'x') { dx = val - m.mesh.position.x; m.mesh.position.x = val }
      else if (m.axis === 'y') { dy = val - m.mesh.position.y; m.mesh.position.y = val }
      else if (m.axis === 'z') { dz = val - m.mesh.position.z; m.mesh.position.z = val }
      const wp = worldPlatforms.find((p) => p.mesh === m.mesh)
      if (wp) {
        wp.minX += dx; wp.maxX += dx
        wp.minY += dy; wp.maxY += dy
        wp.minZ += dz; wp.maxZ += dz
        wp._dx = dx; wp._dy = dy; wp._dz = dz
      }
    }
    // Phasers : apparaissent/disparaissent
    for (const p of phasers) {
      const cyc = ((t / (p.period || 2)) + (p.phase || 0) / (Math.PI * 2)) % 1
      const active = cyc < (p.dutyCycle || 0.5)
      p._inactive = !active
      p.mesh.visible = active
      // M&ecirc;me _inactive sur worldPlatform
      const wp = worldPlatforms.find((w) => w.mesh === p.mesh)
      if (wp) wp._inactive = !active
      // Effet visuel : pulsation d'opacit&eacute; avant disparition
      if (active) {
        const remaining = (p.dutyCycle || 0.5) - cyc
        if (remaining < 0.15) {
          p.mesh.material.opacity = 0.4 + 0.55 * (remaining / 0.15)
        } else {
          p.mesh.material.opacity = 0.95
        }
      }
    }
  }

  return {
    root,
    platforms: worldPlatforms,
    hazards: worldHazards,
    checkpoints: checkpoints.map((c) => ({ ...c })),
    goal,
    fallY: origin.y - 1.5,
    animate,
    disposables,
    spawnPoint,
    worldBounds: {
      minX: origin.x - 50, maxX: origin.x + 120,
      minZ: origin.z - 45, maxZ: origin.z + 45,
    },
    updateLeaderboard: (entries) => billboard.draw(entries),
  }
}

// ============================================================================
// Panneau de classement (plane + CanvasTexture)
// ============================================================================
function createLeaderboardBillboard(root, disposables, startX, startZ) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 768
  const ctx = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  disposables.push(tex)

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  disposables.push(mat)
  const geo = new THREE.PlaneGeometry(9, 6.75)
  disposables.push(geo)
  const plane = new THREE.Mesh(geo, mat)
  // Place le panneau au-dessus de la plateforme de d&eacute;part, lisible de face
  plane.position.set(startX, 5, startZ - 6)
  plane.rotation.y = 0
  root.add(plane)

  // Cadre (poteaux en bois)
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.9 })
  disposables.push(postMat)
  const postGeoL = new THREE.BoxGeometry(0.3, 10, 0.3)
  disposables.push(postGeoL)
  for (const off of [-4.7, 4.7]) {
    const post = new THREE.Mesh(postGeoL, postMat)
    post.position.set(startX + off, 5, startZ - 6.1)
    post.castShadow = true
    root.add(post)
  }
  const crossGeo = new THREE.BoxGeometry(10, 0.3, 0.3)
  disposables.push(crossGeo)
  const crossTop = new THREE.Mesh(crossGeo, postMat)
  crossTop.position.set(startX, 9.5, startZ - 6.1)
  root.add(crossTop)

  function draw(entries) {
    // Fond
    const g = ctx.createLinearGradient(0, 0, 0, 768)
    g.addColorStop(0, '#0a0f1a')
    g.addColorStop(1, '#1e2a3a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1024, 768)
    // Bordure or
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, 1014, 758)
    // Ligne d&eacute;co
    ctx.strokeStyle = 'rgba(255,215,0,0.3)'
    ctx.lineWidth = 2
    ctx.strokeRect(20, 20, 984, 728)

    // Titre
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 72px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('\u{1F3C6} CLASSEMENT', 512, 100)
    ctx.font = '32px monospace'
    ctx.fillStyle = '#8899a6'
    ctx.fillText('iPARKOUR - Meilleurs temps', 512, 148)
    ctx.fillStyle = '#444b55'
    ctx.fillRect(80, 170, 864, 2)

    if (!entries || entries.length === 0) {
      ctx.fillStyle = '#8899a6'
      ctx.textAlign = 'center'
      ctx.font = 'bold 40px monospace'
      ctx.fillText('Aucun temps enregistre', 512, 400)
      ctx.font = '26px monospace'
      ctx.fillText('Sois le premier a terminer le parkour !', 512, 450)
      tex.needsUpdate = true
      return
    }

    const rowH = 50
    const startY = 230
    entries.slice(0, 10).forEach((e, i) => {
      const yy = startY + i * rowH
      if (i === 0) {
        ctx.fillStyle = 'rgba(255,215,0,0.12)'
        ctx.fillRect(50, yy - 38, 924, rowH - 4)
      } else if (i < 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fillRect(50, yy - 38, 924, rowH - 4)
      }
      const medalColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#e1e8ed'
      ctx.fillStyle = medalColor
      ctx.textAlign = 'left'
      ctx.font = 'bold 36px monospace'
      const rank = i < 3 ? ['\u{1F947}', '\u{1F948}', '\u{1F949}'][i] : `#${i + 1}`
      ctx.fillText(rank, 70, yy)
      ctx.font = 'bold 28px monospace'
      ctx.fillText((e.name || 'Inconnu').slice(0, 20), 180, yy)
      ctx.textAlign = 'right'
      ctx.font = 'bold 32px monospace'
      ctx.fillText(formatLbTime(e.timeMs), 950, yy)
    })
    tex.needsUpdate = true
  }

  draw(null)
  return { mesh: plane, draw }
}

// ============================================================================
// Entr&eacute;e monumentale du parkour (arche dor&eacute;e + chemin + torches)
// ============================================================================
function buildParkourEntrance(root, disposables, startX, startZ) {
  // Position de l'arche : devant la plateforme de d&eacute;part (c&ocirc;t&eacute; campus)
  const archX = startX - 8
  const archZ = startZ
  const COL_H = 8
  const COL_W = 1.6

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3a3d45, roughness: 0.9 })
  const stoneLightMat = new THREE.MeshStandardMaterial({ color: 0x4e525c, roughness: 0.85 })
  const goldMat2 = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x3a2800, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.7 })
  disposables.push(stoneMat, stoneLightMat, goldMat2)

  // Colonnes
  const colGeo = new THREE.BoxGeometry(COL_W, COL_H, COL_W)
  disposables.push(colGeo)
  for (const zOff of [-3, 3]) {
    const col = new THREE.Mesh(colGeo, stoneMat)
    col.position.set(archX, COL_H / 2, archZ + zOff)
    col.castShadow = true
    col.receiveShadow = true
    root.add(col)
    // Chapiteau
    const capGeo = new THREE.BoxGeometry(COL_W + 0.6, 0.5, COL_W + 0.6)
    disposables.push(capGeo)
    const cap = new THREE.Mesh(capGeo, stoneLightMat)
    cap.position.set(archX, COL_H + 0.25, archZ + zOff)
    cap.castShadow = true
    root.add(cap)
    // Socle
    const baseGeo = new THREE.BoxGeometry(COL_W + 0.8, 0.6, COL_W + 0.8)
    disposables.push(baseGeo)
    const base = new THREE.Mesh(baseGeo, stoneLightMat)
    base.position.set(archX, 0.3, archZ + zOff)
    base.receiveShadow = true
    root.add(base)
  }

  // Linteau (traverse horizontale au sommet)
  const lintelGeo = new THREE.BoxGeometry(COL_W + 0.8, 1.2, 7.6)
  disposables.push(lintelGeo)
  const lintel = new THREE.Mesh(lintelGeo, stoneLightMat)
  lintel.position.set(archX, COL_H + 1.1, archZ)
  lintel.castShadow = true
  root.add(lintel)

  // Fronton dor&eacute; (triangle symbolique = petit bloc biseaut&eacute;)
  const frontGeo = new THREE.BoxGeometry(0.4, 0.9, 6)
  disposables.push(frontGeo)
  const front = new THREE.Mesh(frontGeo, goldMat2)
  front.position.set(archX + 0.1, COL_H + 2.0, archZ)
  root.add(front)

  // Plaque/sign 'iPARKOUR' sur l'arche (canvas texture)
  const signCanvas = document.createElement('canvas')
  signCanvas.width = 1024
  signCanvas.height = 256
  const sctx = signCanvas.getContext('2d')
  const sg = sctx.createLinearGradient(0, 0, 0, 256)
  sg.addColorStop(0, '#1a0d00')
  sg.addColorStop(1, '#3a1d00')
  sctx.fillStyle = sg
  sctx.fillRect(0, 0, 1024, 256)
  sctx.strokeStyle = '#ffd700'
  sctx.lineWidth = 8
  sctx.strokeRect(6, 6, 1012, 244)
  sctx.fillStyle = '#ffd700'
  sctx.font = 'bold 140px serif'
  sctx.textAlign = 'center'
  sctx.textBaseline = 'middle'
  sctx.shadowColor = '#ff6600'
  sctx.shadowBlur = 30
  sctx.fillText('iPARKOUR', 512, 110)
  sctx.shadowBlur = 0
  sctx.font = 'bold 42px monospace'
  sctx.fillStyle = '#e0245e'
  sctx.fillText('\u2620 ENFER EXTR\u00caME \u2620', 512, 200)
  const signTex = new THREE.CanvasTexture(signCanvas)
  signTex.colorSpace = THREE.SRGBColorSpace
  signTex.needsUpdate = true
  disposables.push(signTex)
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true })
  disposables.push(signMat)
  const signGeo = new THREE.PlaneGeometry(7, 1.6)
  disposables.push(signGeo)
  const sign = new THREE.Mesh(signGeo, signMat)
  sign.position.set(archX - 0.4, COL_H + 1.1, archZ)
  sign.rotation.y = -Math.PI / 2
  root.add(sign)
  // Face arri&egrave;re (pour lire depuis l'autre c&ocirc;t&eacute;)
  const signBack = new THREE.Mesh(signGeo, signMat)
  signBack.position.set(archX + 0.4, COL_H + 1.1, archZ)
  signBack.rotation.y = Math.PI / 2
  root.add(signBack)

  // Torches aux pieds des colonnes
  const torchBaseMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0d, roughness: 0.9 })
  disposables.push(torchBaseMat)
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.9 })
  disposables.push(flameMat)
  for (const zOff of [-3, 3]) {
    // Poteau de torche
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8)
    disposables.push(poleGeo)
    const pole = new THREE.Mesh(poleGeo, torchBaseMat)
    pole.position.set(archX - 1.5, 0.9, archZ + zOff)
    pole.castShadow = true
    root.add(pole)
    // Flamme
    const flameGeo = new THREE.ConeGeometry(0.35, 0.9, 8)
    disposables.push(flameGeo)
    const flame = new THREE.Mesh(flameGeo, flameMat)
    flame.position.set(archX - 1.5, 2.1, archZ + zOff)
    root.add(flame)
    // Lumi&egrave;re ponctuelle
    const light = new THREE.PointLight(0xff7722, 2.5, 14, 1.6)
    light.position.set(archX - 1.5, 2.3, archZ + zOff)
    root.add(light)
  }

  // Chemin pav&eacute; menant &agrave; l'arche (depuis le campus vers la plateforme de d&eacute;part)
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x7a6a48, roughness: 0.95 })
  disposables.push(pathMat)
  const pathGeo = new THREE.BoxGeometry(25, 0.1, 5)
  disposables.push(pathGeo)
  const path = new THREE.Mesh(pathGeo, pathMat)
  path.position.set(archX - 12, 0.05, archZ)
  path.receiveShadow = true
  root.add(path)

  // Dalles plus claires dans le chemin pour l'effet visuel
  const tileMat = new THREE.MeshStandardMaterial({ color: 0x9a8a68, roughness: 0.9 })
  disposables.push(tileMat)
  const tileGeo = new THREE.BoxGeometry(1.8, 0.15, 1.8)
  disposables.push(tileGeo)
  for (let i = 0; i < 10; i++) {
    for (const zRow of [-1.4, 1.4]) {
      const tile = new THREE.Mesh(tileGeo, tileMat)
      tile.position.set(archX - 2 - i * 2.2, 0.08, archZ + zRow)
      tile.receiveShadow = true
      root.add(tile)
    }
  }

  // Petit banc d'accueil / pr&eacute;sentoir &agrave; l'entr&eacute;e
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 })
  disposables.push(benchMat)
  const benchGeo = new THREE.BoxGeometry(4, 0.3, 0.6)
  disposables.push(benchGeo)
  const bench = new THREE.Mesh(benchGeo, benchMat)
  bench.position.set(archX - 6, 0.5, archZ - 5)
  bench.castShadow = true
  root.add(bench)
}

function makeCheckpointFlag(root, x, y, z, disposables) {
  const group = new THREE.Group()
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8)
  disposables.push(poleGeo)
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 })
  disposables.push(poleMat)
  const pole = new THREE.Mesh(poleGeo, poleMat)
  pole.position.y = 1.25
  group.add(pole)
  const flagGeo = new THREE.PlaneGeometry(0.9, 0.6)
  disposables.push(flagGeo)
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xffd700, side: THREE.DoubleSide, emissive: 0x554400, emissiveIntensity: 0.5 })
  disposables.push(flagMat)
  const flag = new THREE.Mesh(flagGeo, flagMat)
  flag.position.set(0.45, 2.1, 0)
  group.add(flag)
  group.position.set(x, y, z)
  root.add(group)
  return group
}
