import * as THREE from 'three'

// GIF servi en local (public/cinema.gif) → pas de CORS, le canvas reste
// non-tainté et la texture peut être mise à jour à chaque frame.
// Préfixé par BASE_URL car Vite est configuré avec base: '/ICAN/'.
// Source originale : https://i.redd.it/5tcrzoxurp1g1.gif
const DEFAULT_GIF_URL = `${import.meta.env.BASE_URL}cinema.gif`

// iCINEMA — bâtiment dans lequel le joueur peut entrer pour voir un GIF
// projeté sur un écran géant. Les GIFs ne sont pas supportés nativement
// par Three.js, donc on s'appuie sur un <img> HTML (qui anime le GIF
// naturellement) recopié à chaque frame dans un canvas servant de texture.
export function createCinema({
  origin = new THREE.Vector3(-95, 0, -40),
  gifUrl = DEFAULT_GIF_URL,
} = {}) {
  const group = new THREE.Group()
  group.position.copy(origin)
  const disposables = []
  const obstacles = []

  const W = 32          // largeur (X)
  const D = 26          // profondeur (Z)
  const H = 12          // hauteur
  const WALL_T = 0.6    // épaisseur des murs
  const DOOR_W = 6      // largeur de l'ouverture (au sud, +Z)
  const DOOR_H = 3.2    // hauteur de l'ouverture

  // --- Matériaux ---
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x6b1e1e, roughness: 0.85 })
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf2c84b, roughness: 0.5, metalness: 0.5,
    emissive: 0xffaa33, emissiveIntensity: 0.25,
  })
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a1a22, roughness: 0.95 })
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 1 })
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x401818, roughness: 0.9 })
  const screenFrameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
  disposables.push(wallMat, trimMat, floorMat, ceilMat, seatMat, screenFrameMat)

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

  // Mur arrière (nord, écran)
  addWall(0, -D / 2 + WALL_T / 2, W, WALL_T)
  // Mur ouest
  addWall(-W / 2 + WALL_T / 2, 0, WALL_T, D)
  // Mur est
  addWall(W / 2 - WALL_T / 2, 0, WALL_T, D)
  // Mur sud — coupé en deux pour laisser passer la porte
  const segW = (W - DOOR_W) / 2
  addWall(-(W / 2 - segW / 2), D / 2 - WALL_T / 2, segW, WALL_T)
  addWall((W / 2 - segW / 2), D / 2 - WALL_T / 2, segW, WALL_T)
  // Linteau au-dessus de la porte (mesh seul, hors de portée du joueur)
  const lintelGeo = new THREE.BoxGeometry(DOOR_W, H - DOOR_H, WALL_T)
  const lintel = new THREE.Mesh(lintelGeo, wallMat)
  lintel.position.set(0, DOOR_H + (H - DOOR_H) / 2, D / 2 - WALL_T / 2)
  lintel.castShadow = true
  group.add(lintel)
  disposables.push(lintelGeo)

  // --- Marquise extérieure (au-dessus de la porte) ---
  const marqueeGeo = new THREE.BoxGeometry(DOOR_W + 4, 1.6, 1.5)
  const marquee = new THREE.Mesh(marqueeGeo, trimMat)
  marquee.position.set(0, 4.2, D / 2 + 0.7)
  marquee.castShadow = true
  group.add(marquee)
  disposables.push(marqueeGeo)

  // --- Enseigne "iCINEMA" ---
  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 512
  labelCanvas.height = 128
  const lctx = labelCanvas.getContext('2d')
  lctx.fillStyle = '#1a0808'
  lctx.fillRect(0, 0, 512, 128)
  lctx.fillStyle = '#fff2c0'
  for (let i = 0; i < 16; i++) {
    lctx.beginPath()
    lctx.arc(16 + i * 32, 14, 6, 0, Math.PI * 2)
    lctx.fill()
    lctx.beginPath()
    lctx.arc(16 + i * 32, 116, 6, 0, Math.PI * 2)
    lctx.fill()
  }
  lctx.fillStyle = '#f2c84b'
  lctx.font = 'bold 80px Georgia, serif'
  lctx.textAlign = 'center'
  lctx.textBaseline = 'middle'
  lctx.fillText('iCINEMA', 256, 66)
  const labelTex = new THREE.CanvasTexture(labelCanvas)
  labelTex.colorSpace = THREE.SRGBColorSpace
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTex,
    emissive: 0xffaa33,
    emissiveIntensity: 0.7,
  })
  const labelGeo = new THREE.PlaneGeometry(DOOR_W + 4, 1.6)
  const label = new THREE.Mesh(labelGeo, labelMat)
  label.position.set(0, 4.2, D / 2 + 1.46)
  group.add(label)
  disposables.push(labelTex, labelMat, labelGeo)

  // --- Marches de l'entrée ---
  const stepMat = new THREE.MeshStandardMaterial({ color: 0xb0392b, roughness: 0.85 })
  disposables.push(stepMat)
  for (let i = 0; i < 3; i++) {
    const sgeo = new THREE.BoxGeometry(DOOR_W + 1.4 + i * 0.4, 0.18, 0.6)
    const s = new THREE.Mesh(sgeo, stepMat)
    s.position.set(0, 0.09 + i * 0.18, D / 2 + 0.4 + i * 0.6)
    s.receiveShadow = true
    group.add(s)
    disposables.push(sgeo)
  }

  // --- Écran géant (GIF) ---
  const SCREEN_W = W - 6
  const SCREEN_H = 7
  const SCREEN_Y = 4.5
  const SCREEN_Z = -D / 2 + WALL_T + 0.05

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
  // MeshBasicMaterial pour que l'écran reste lumineux quelle que soit la lumière
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })
  const screenGeo = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H)
  const screen = new THREE.Mesh(screenGeo, screenMat)
  screen.position.set(0, SCREEN_Y, SCREEN_Z)
  group.add(screen)
  disposables.push(screenTex, screenMat, screenGeo)

  // Cadre de l'écran
  const frameThk = 0.4
  const frameSideGeo = new THREE.BoxGeometry(frameThk, SCREEN_H + frameThk * 2, 0.3)
  const frameTBGeo = new THREE.BoxGeometry(SCREEN_W + frameThk * 2, frameThk, 0.3)
  for (const x of [-SCREEN_W / 2 - frameThk / 2, SCREEN_W / 2 + frameThk / 2]) {
    const f = new THREE.Mesh(frameSideGeo, screenFrameMat)
    f.position.set(x, SCREEN_Y, SCREEN_Z + 0.05)
    group.add(f)
  }
  for (const y of [SCREEN_Y - SCREEN_H / 2 - frameThk / 2, SCREEN_Y + SCREEN_H / 2 + frameThk / 2]) {
    const f = new THREE.Mesh(frameTBGeo, screenFrameMat)
    f.position.set(0, y, SCREEN_Z + 0.05)
    group.add(f)
  }
  disposables.push(frameSideGeo, frameTBGeo)

  // --- Sièges du cinéma ---
  const seatGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8)
  const backGeo = new THREE.BoxGeometry(0.8, 1.2, 0.2)
  disposables.push(seatGeo, backGeo)
  const rows = 4
  const cols = 9
  const spX = 1.3
  const spZ = 1.5
  const startZ = D / 2 - 5
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Allée centrale entre les colonnes 4 et 5
      if (c === 4) continue
      const sx = (c - (cols - 1) / 2) * spX
      const sz = startZ - r * spZ
      const seat = new THREE.Mesh(seatGeo, seatMat)
      seat.position.set(sx, 0.4, sz)
      seat.castShadow = true
      group.add(seat)
      const back = new THREE.Mesh(backGeo, seatMat)
      back.position.set(sx, 1.0, sz + 0.3)
      back.castShadow = true
      group.add(back)
    }
  }

  // --- Lumière émanant de l'écran (ambiance ciné) ---
  const screenLight = new THREE.PointLight(0xffd590, 1.6, 24, 2)
  screenLight.position.set(0, SCREEN_Y, SCREEN_Z + 6)
  group.add(screenLight)

  // --- Décodage du GIF frame par frame via WebCodecs ImageDecoder ---
  // Note : drawImage(<img>) ne capture que la 1re frame d'un GIF animé sur la
  // plupart des navigateurs (le décodeur GIF tourne séparément du contexte 2D).
  // ImageDecoder permet de récupérer chaque VideoFrame et son timing réel.
  let frames = []          // [{ image: VideoFrame, durationMs: number }]
  let totalDurationMs = 0
  let loadStatus = 'loading' // 'loading' | 'ready' | 'failed' | 'unsupported'
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
      // tracks est peuplé de manière asynchrone — attendre tracks.ready
      // avant d'accéder à selectedTrack.frameCount.
      await decoder.tracks.ready
      await decoder.completed
      const track = decoder.tracks.selectedTrack
      if (!track) throw new Error('Aucune piste GIF décodable')
      const count = track.frameCount
      const decoded = []
      let total = 0
      for (let i = 0; i < count; i++) {
        const result = await decoder.decode({ frameIndex: i })
        // VideoFrame.duration est en microsecondes (peut être null → 100ms)
        const durMs = result.image.duration ? result.image.duration / 1000 : 100
        decoded.push({ image: result.image, durationMs: durMs })
        total += durMs
      }
      frames = decoded
      totalDurationMs = total > 0 ? total : decoded.length * 100
      loadStatus = 'ready'
    } catch (err) {
      console.warn('[iCINEMA] Échec du décodage GIF :', err)
      loadStatus = 'failed'
    }
  })()

  let lastDrawn = -1
  const animate = () => {
    if (loadStatus !== 'ready') {
      if (!statusRendered) {
        if (loadStatus === 'failed') drawStatusMessage('GIF indisponible', '#bbb')
        else if (loadStatus === 'unsupported') drawStatusMessage('Navigateur non supporté', '#bbb')
        // 'loading' garde le message initial
        statusRendered = true
      }
      return
    }
    if (frames.length === 0) return

    // Repère temporel dans la boucle complète du GIF
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
