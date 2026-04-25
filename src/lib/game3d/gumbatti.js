import * as THREE from 'three'

// GIF servi en local (public/gumbatti.gif) → pas de CORS, le canvas reste
// non-tainté et la texture peut être mise à jour à chaque frame.
// Préfixé par BASE_URL car Vite est configuré avec base: '/ICAN/'.
// Source originale : https://tenor.com/zsVp0kAOgz.gif (Gordon Ramsay)
const DEFAULT_GIF_URL = `${import.meta.env.BASE_URL}gumbatti.gif`

// Chez Gumbatti — pizzeria italienne. Le joueur peut entrer pour manger
// une part de pizza pendant qu'un écran TV diffuse Gordon Ramsay en boucle.
// Même technique que iCINEMA pour le décodage GIF (ImageDecoder + canvas).
export function createGumbatti({
  origin = new THREE.Vector3(95, 0, -40),
  gifUrl = DEFAULT_GIF_URL,
} = {}) {
  const group = new THREE.Group()
  group.position.copy(origin)
  const disposables = []
  const obstacles = []

  const W = 28          // largeur (X)
  const D = 22          // profondeur (Z)
  const H = 8           // hauteur (plus bas qu'un cinéma)
  const WALL_T = 0.6
  const DOOR_W = 4.5
  const DOOR_H = 3

  // --- Matériaux ---
  // Crépi terracotta italien
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd97a4a, roughness: 0.9 })
  // Toit en tuiles rouges
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.85 })
  // Sol carrelage damier (généré ci-dessous)
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2e6b3a, roughness: 0.6 }) // vert italien
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b3a1c, roughness: 0.85 })
  const ovenMat = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.95 })
  const fireMat = new THREE.MeshStandardMaterial({
    color: 0xff7020, emissive: 0xff5010, emissiveIntensity: 1.2,
  })
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.95 })
  const tableclothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x4a2818, roughness: 0.85 })
  const tvFrameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.6 })
  disposables.push(
    wallMat, roofMat, trimMat, woodMat, ovenMat, fireMat,
    ceilMat, tableclothMat, chairMat, tvFrameMat,
  )

  // --- Sol carrelage damier rouge/blanc ---
  const tileCanvas = document.createElement('canvas')
  tileCanvas.width = 256
  tileCanvas.height = 256
  const tctx = tileCanvas.getContext('2d')
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      tctx.fillStyle = (x + y) % 2 === 0 ? '#f5f0e6' : '#b03020'
      tctx.fillRect(x * 32, y * 32, 32, 32)
    }
  }
  const tileTex = new THREE.CanvasTexture(tileCanvas)
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping
  tileTex.repeat.set(4, 4)
  tileTex.colorSpace = THREE.SRGBColorSpace
  const floorMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.7 })
  disposables.push(tileTex, floorMat)

  // --- Sol ---
  const floorGeo = new THREE.PlaneGeometry(W - 2 * WALL_T, D - 2 * WALL_T)
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.02
  floor.receiveShadow = true
  group.add(floor)
  disposables.push(floorGeo)

  // --- Plafond ---
  const ceilGeo = new THREE.PlaneGeometry(W - 2 * WALL_T, D - 2 * WALL_T)
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = H - 0.05
  group.add(ceiling)
  disposables.push(ceilGeo)

  // --- Helper murs : ajoute un mesh + l'AABB en monde dans obstacles ---
  const addWall = (cx, cz, w, d, h = H, y = h / 2) => {
    const geo = new THREE.BoxGeometry(w, h, d)
    const mesh = new THREE.Mesh(geo, wallMat)
    mesh.position.set(cx, y, cz)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    disposables.push(geo)
    obstacles.push({
      minX: origin.x + cx - w / 2,
      maxX: origin.x + cx + w / 2,
      minZ: origin.z + cz - d / 2,
      maxZ: origin.z + cz + d / 2,
    })
  }

  // Murs : porte au sud (+Z) comme pour le cinéma
  addWall(0, -D / 2 + WALL_T / 2, W, WALL_T)        // nord
  addWall(-W / 2 + WALL_T / 2, 0, WALL_T, D)        // ouest
  addWall(W / 2 - WALL_T / 2, 0, WALL_T, D)         // est
  const segW = (W - DOOR_W) / 2
  addWall(-(W / 2 - segW / 2), D / 2 - WALL_T / 2, segW, WALL_T) // sud gauche
  addWall((W / 2 - segW / 2), D / 2 - WALL_T / 2, segW, WALL_T)  // sud droit
  // Linteau (visuel, pas d'obstacle)
  const lintelGeo = new THREE.BoxGeometry(DOOR_W, H - DOOR_H, WALL_T)
  const lintel = new THREE.Mesh(lintelGeo, wallMat)
  lintel.position.set(0, DOOR_H + (H - DOOR_H) / 2, D / 2 - WALL_T / 2)
  lintel.castShadow = true
  group.add(lintel)
  disposables.push(lintelGeo)

  // --- Toit en pente (deux pans) ---
  const roofH = 2.5
  const roofGeo = new THREE.BoxGeometry(W + 1.2, 0.3, D / 2 + 0.6)
  for (const side of [-1, 1]) {
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.set(0, H + roofH / 2, side * (D / 4 - 0.3))
    roof.rotation.x = side * 0.6
    roof.castShadow = true
    group.add(roof)
  }
  disposables.push(roofGeo)

  // Pignons triangulaires (est / ouest) en simple Box pour rester simple
  const gableGeo = new THREE.BoxGeometry(WALL_T, roofH, D)
  for (const x of [-W / 2 + WALL_T / 2, W / 2 - WALL_T / 2]) {
    const g = new THREE.Mesh(gableGeo, wallMat)
    g.position.set(x, H + roofH / 2, 0)
    group.add(g)
  }
  disposables.push(gableGeo)

  // --- Auvent vert/blanc/rouge au-dessus de la porte ---
  const awningGeo = new THREE.BoxGeometry(DOOR_W + 4, 0.3, 1.8)
  const awning = new THREE.Mesh(awningGeo, trimMat)
  awning.position.set(0, 4, D / 2 + 0.9)
  awning.rotation.x = -0.25
  awning.castShadow = true
  group.add(awning)
  disposables.push(awningGeo)

  // Bandes verticales blanches/rouges sur le bord de l'auvent
  const stripeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 })
  const stripeRedMat = new THREE.MeshStandardMaterial({ color: 0xc02828, roughness: 0.7 })
  disposables.push(stripeWhiteMat, stripeRedMat)
  const stripeGeo = new THREE.BoxGeometry(0.7, 0.45, 0.05)
  const stripeY = 4 - Math.sin(0.25) * 0.9 + 0.1
  const stripeZ = D / 2 + 0.9 + Math.cos(0.25) * 0.85
  const stripeCount = Math.floor((DOOR_W + 4) / 0.7)
  for (let i = 0; i < stripeCount; i++) {
    const x = -((stripeCount - 1) * 0.7) / 2 + i * 0.7
    const mat = i % 2 === 0 ? stripeWhiteMat : stripeRedMat
    const s = new THREE.Mesh(stripeGeo, mat)
    s.position.set(x, stripeY, stripeZ)
    s.rotation.x = -0.25
    group.add(s)
  }
  disposables.push(stripeGeo)

  // --- Enseigne "Chez Gumbatti" ---
  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 512
  labelCanvas.height = 128
  const lctx = labelCanvas.getContext('2d')
  // Fond crème
  lctx.fillStyle = '#f5e8c8'
  lctx.fillRect(0, 0, 512, 128)
  // Bordure tricolore italienne
  lctx.fillStyle = '#2e6b3a'
  lctx.fillRect(0, 0, 12, 128)
  lctx.fillStyle = '#c02828'
  lctx.fillRect(500, 0, 12, 128)
  lctx.fillStyle = '#c02828'
  lctx.fillRect(0, 0, 512, 8)
  lctx.fillRect(0, 120, 512, 8)
  // Texte
  lctx.fillStyle = '#3a1818'
  lctx.font = 'italic bold 56px "Brush Script MT", Georgia, serif'
  lctx.textAlign = 'center'
  lctx.textBaseline = 'middle'
  lctx.fillText('Chez Gumbatti', 256, 56)
  lctx.fillStyle = '#8a3010'
  lctx.font = 'italic 22px Georgia, serif'
  lctx.fillText('★ Pizzeria ★', 256, 100)
  const labelTex = new THREE.CanvasTexture(labelCanvas)
  labelTex.colorSpace = THREE.SRGBColorSpace
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTex,
    emissive: 0xffffff,
    emissiveMap: labelTex,
    emissiveIntensity: 0.25,
  })
  const labelGeo = new THREE.PlaneGeometry(DOOR_W + 3.5, 1.4)
  const label = new THREE.Mesh(labelGeo, labelMat)
  label.position.set(0, 5.6, D / 2 + 0.05)
  group.add(label)
  disposables.push(labelTex, labelMat, labelGeo)

  // --- Marches de l'entrée ---
  const stepMat = new THREE.MeshStandardMaterial({ color: 0xa05030, roughness: 0.85 })
  disposables.push(stepMat)
  for (let i = 0; i < 2; i++) {
    const sgeo = new THREE.BoxGeometry(DOOR_W + 1.2 + i * 0.4, 0.18, 0.6)
    const s = new THREE.Mesh(sgeo, stepMat)
    s.position.set(0, 0.09 + i * 0.18, D / 2 + 0.4 + i * 0.6)
    s.receiveShadow = true
    group.add(s)
    disposables.push(sgeo)
  }

  // --- Comptoir & four à pizza (mur nord intérieur) ---
  const counterGeo = new THREE.BoxGeometry(W - 6, 1.1, 1.8)
  const counter = new THREE.Mesh(counterGeo, woodMat)
  counter.position.set(0, 0.55, -D / 2 + WALL_T + 1.1)
  counter.castShadow = true
  group.add(counter)
  disposables.push(counterGeo)

  // Four à pizza voûté (dome) à droite du comptoir
  const ovenBaseGeo = new THREE.BoxGeometry(4, 1.4, 3)
  const ovenBase = new THREE.Mesh(ovenBaseGeo, ovenMat)
  ovenBase.position.set(W / 2 - 4, 0.7, -D / 2 + WALL_T + 1.6)
  ovenBase.castShadow = true
  group.add(ovenBase)
  disposables.push(ovenBaseGeo)

  const ovenDomeGeo = new THREE.SphereGeometry(1.6, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2)
  const ovenDome = new THREE.Mesh(ovenDomeGeo, ovenMat)
  ovenDome.position.set(W / 2 - 4, 1.4, -D / 2 + WALL_T + 1.6)
  ovenDome.castShadow = true
  group.add(ovenDome)
  disposables.push(ovenDomeGeo)

  // Bouche du four (avec feu visible)
  const ovenMouthGeo = new THREE.BoxGeometry(1.4, 0.8, 0.3)
  const ovenMouth = new THREE.Mesh(ovenMouthGeo, fireMat)
  ovenMouth.position.set(W / 2 - 4, 1.4, -D / 2 + WALL_T + 1.6 + 1.5)
  group.add(ovenMouth)
  disposables.push(ovenMouthGeo)

  // Lueur du four
  const fireLight = new THREE.PointLight(0xff7030, 1.8, 12, 2)
  fireLight.position.set(W / 2 - 4, 1.6, -D / 2 + WALL_T + 1.6 + 1.5)
  group.add(fireLight)

  // --- Tables rondes + chaises ---
  const tableTopGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.08, 24)
  const tableLegGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.95, 8)
  const chairSeatGeo = new THREE.BoxGeometry(0.55, 0.08, 0.55)
  const chairBackGeo = new THREE.BoxGeometry(0.55, 0.7, 0.08)
  const chairLegGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6)
  disposables.push(tableTopGeo, tableLegGeo, chairSeatGeo, chairBackGeo, chairLegGeo)

  // 4 tables réparties dans la salle (devant le comptoir)
  const tablePositions = [
    [-W / 2 + 4.5, -D / 2 + 8],
    [W / 2 - 4.5, -D / 2 + 8],
    [-W / 2 + 4.5, D / 2 - 5],
    [W / 2 - 4.5, D / 2 - 5],
  ]
  for (const [tx, tz] of tablePositions) {
    // Pied
    const leg = new THREE.Mesh(tableLegGeo, woodMat)
    leg.position.set(tx, 0.475, tz)
    group.add(leg)
    // Plateau
    const top = new THREE.Mesh(tableTopGeo, woodMat)
    top.position.set(tx, 0.95, tz)
    top.castShadow = true
    group.add(top)
    // Nappe à carreaux (disque blanc juste dessus)
    const cloth = new THREE.Mesh(tableTopGeo, tableclothMat)
    cloth.position.set(tx, 1.0, tz)
    cloth.scale.set(1.05, 0.4, 1.05)
    group.add(cloth)
    // 4 chaises
    for (const [cx, cz, cr] of [
      [tx + 1.1, tz, -Math.PI / 2],
      [tx - 1.1, tz, Math.PI / 2],
      [tx, tz + 1.1, 0],
      [tx, tz - 1.1, Math.PI],
    ]) {
      const seat = new THREE.Mesh(chairSeatGeo, chairMat)
      seat.position.set(cx, 0.5, cz)
      seat.rotation.y = cr
      seat.castShadow = true
      group.add(seat)
      const back = new THREE.Mesh(chairBackGeo, chairMat)
      back.position.set(cx, 0.85, cz)
      back.rotation.y = cr
      // Décale le dossier vers l'arrière de la chaise
      back.position.x += Math.sin(cr) * 0.24
      back.position.z += Math.cos(cr) * 0.24
      group.add(back)
      // 4 pieds par chaise
      for (const [lx, lz] of [[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]]) {
        const l = new THREE.Mesh(chairLegGeo, chairMat)
        const c = Math.cos(cr), s = Math.sin(cr)
        l.position.set(cx + lx * c - lz * s, 0.25, cz + lx * s + lz * c)
        group.add(l)
      }
    }
  }

  // --- TV murale (mur ouest) avec GIF Gordon Ramsay ---
  const TV_W = 6
  const TV_H = 3.4
  const TV_Y = 4
  const TV_X = -W / 2 + WALL_T + 0.05

  const screenCanvas = document.createElement('canvas')
  screenCanvas.width = 1024
  screenCanvas.height = 576
  const sctx = screenCanvas.getContext('2d')
  sctx.fillStyle = '#000'
  sctx.fillRect(0, 0, screenCanvas.width, screenCanvas.height)
  sctx.fillStyle = '#666'
  sctx.font = '40px sans-serif'
  sctx.textAlign = 'center'
  sctx.textBaseline = 'middle'
  sctx.fillText('Chargement…', screenCanvas.width / 2, screenCanvas.height / 2)

  const screenTex = new THREE.CanvasTexture(screenCanvas)
  screenTex.colorSpace = THREE.SRGBColorSpace
  screenTex.minFilter = THREE.LinearFilter
  screenTex.magFilter = THREE.LinearFilter
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })
  const screenGeo = new THREE.PlaneGeometry(TV_W, TV_H)
  const screen = new THREE.Mesh(screenGeo, screenMat)
  screen.position.set(TV_X, TV_Y, 0)
  screen.rotation.y = Math.PI / 2
  group.add(screen)
  disposables.push(screenTex, screenMat, screenGeo)

  // Cadre TV
  const tvFrameSideGeo = new THREE.BoxGeometry(0.2, TV_H + 0.4, 0.3)
  const tvFrameTBGeo = new THREE.BoxGeometry(0.2, 0.2, TV_W + 0.4)
  for (const dz of [-TV_W / 2 - 0.1, TV_W / 2 + 0.1]) {
    const f = new THREE.Mesh(tvFrameSideGeo, tvFrameMat)
    f.position.set(TV_X + 0.05, TV_Y, dz)
    group.add(f)
  }
  for (const dy of [TV_Y - TV_H / 2 - 0.1, TV_Y + TV_H / 2 + 0.1]) {
    const f = new THREE.Mesh(tvFrameTBGeo, tvFrameMat)
    f.position.set(TV_X + 0.05, dy, 0)
    group.add(f)
  }
  disposables.push(tvFrameSideGeo, tvFrameTBGeo)

  // Lumière douce dans la salle
  const ambientLight = new THREE.PointLight(0xffd9a0, 0.9, 28, 2)
  ambientLight.position.set(0, H - 0.6, 0)
  group.add(ambientLight)

  // --- Décodage du GIF (même technique que cinema.js) ---
  let frames = []
  let totalDurationMs = 0
  let loadStatus = 'loading'
  let statusRendered = false

  const drawStatusMessage = (msg, color = '#666') => {
    sctx.fillStyle = '#000'
    sctx.fillRect(0, 0, screenCanvas.width, screenCanvas.height)
    sctx.fillStyle = color
    sctx.font = '40px sans-serif'
    sctx.textAlign = 'center'
    sctx.textBaseline = 'middle'
    sctx.fillText(msg, screenCanvas.width / 2, screenCanvas.height / 2)
    screenTex.needsUpdate = true
  }

  ;(async () => {
    if (typeof ImageDecoder === 'undefined') {
      loadStatus = 'unsupported'
      return
    }
    try {
      const response = await fetch(gifUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buf = await response.arrayBuffer()
      const decoder = new ImageDecoder({ data: buf, type: 'image/gif' })
      await decoder.tracks.ready
      await decoder.completed
      const track = decoder.tracks.selectedTrack
      if (!track) throw new Error('Aucune piste GIF décodable')
      const count = track.frameCount
      const decoded = []
      let total = 0
      for (let i = 0; i < count; i++) {
        const result = await decoder.decode({ frameIndex: i })
        const durMs = result.image.duration ? result.image.duration / 1000 : 100
        decoded.push({ image: result.image, durationMs: durMs })
        total += durMs
      }
      frames = decoded
      totalDurationMs = total > 0 ? total : decoded.length * 100
      loadStatus = 'ready'
    } catch (err) {
      console.warn('[Gumbatti] Échec du décodage GIF :', err)
      loadStatus = 'failed'
    }
  })()

  let lastDrawn = -1
  const animate = () => {
    if (loadStatus !== 'ready') {
      if (!statusRendered) {
        if (loadStatus === 'failed') drawStatusMessage('TV en panne', '#bbb')
        else if (loadStatus === 'unsupported') drawStatusMessage('Navigateur non supporté', '#bbb')
        statusRendered = true
      }
      return
    }
    if (frames.length === 0) return

    const t = performance.now() % totalDurationMs
    let acc = 0
    let idx = 0
    for (let i = 0; i < frames.length; i++) {
      acc += frames[i].durationMs
      if (t < acc) { idx = i; break }
    }
    if (idx === lastDrawn) return
    lastDrawn = idx

    const frame = frames[idx].image
    const fw = frame.displayWidth || frame.codedWidth
    const fh = frame.displayHeight || frame.codedHeight
    const ar = fw / fh
    const cAR = screenCanvas.width / screenCanvas.height
    let dw, dh
    if (ar > cAR) { dw = screenCanvas.width; dh = dw / ar }
    else { dh = screenCanvas.height; dw = dh * ar }
    const dx = (screenCanvas.width - dw) / 2
    const dy = (screenCanvas.height - dh) / 2
    sctx.fillStyle = '#000'
    sctx.fillRect(0, 0, screenCanvas.width, screenCanvas.height)
    sctx.drawImage(frame, dx, dy, dw, dh)
    screenTex.needsUpdate = true
  }

  const dispose = () => {
    for (const f of frames) {
      try { f.image.close?.() } catch { /* ignore */ }
    }
    frames = []
    for (const d of disposables) d.dispose?.()
  }

  return { group, obstacles, disposables, animate, dispose }
}
