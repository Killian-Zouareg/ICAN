import * as THREE from 'three'

// ============================================================================
//  Place des Légendes — statues 3D des héros/vilains du wiki
// ============================================================================

const HERO_TINT = 0xffd700        // or
const HERO_EMISSIVE = 0x554400
const VILLAIN_TINT = 0x7a0a14     // rouge sombre
const VILLAIN_EMISSIVE = 0x300006
const STONE = 0x6f7480

const RING_INNER = 1.6
const RING_OUTER = 2.1

const texLoader = new THREE.TextureLoader()

function makePlaqueTexture(name, side) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 192
  const ctx = canvas.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 0, 192)
  grad.addColorStop(0, '#0a0f1a')
  grad.addColorStop(1, '#1e2a3a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 512, 192)
  const accent = side === 'villain' ? '#ff4d6d' : '#ffd700'
  ctx.strokeStyle = accent
  ctx.lineWidth = 6
  ctx.strokeRect(8, 8, 496, 176)
  ctx.fillStyle = accent
  ctx.font = 'bold 48px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText((name || '???').slice(0, 22), 256, 96)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeStatueGroup(hero, disposables) {
  const g = new THREE.Group()
  const isVillain = hero.side === 'villain'
  const tint = isVillain ? VILLAIN_TINT : HERO_TINT
  const emissive = isVillain ? VILLAIN_EMISSIVE : HERO_EMISSIVE

  // Socle octogonal
  const baseGeo = new THREE.CylinderGeometry(1.4, 1.6, 0.8, 8)
  disposables.push(baseGeo)
  const baseMat = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.95, metalness: 0.05 })
  disposables.push(baseMat)
  const base = new THREE.Mesh(baseGeo, baseMat)
  base.position.y = 0.4
  base.castShadow = true
  base.receiveShadow = true
  g.add(base)

  // Corps stylisé (cape + buste + tête)
  const bodyMat = new THREE.MeshStandardMaterial({
    color: tint,
    emissive,
    emissiveIntensity: 0.25,
    roughness: 0.4,
    metalness: 0.7,
  })
  disposables.push(bodyMat)

  // Buste (tronc tronqué)
  const torsoGeo = new THREE.CylinderGeometry(0.55, 0.75, 1.6, 12)
  disposables.push(torsoGeo)
  const torso = new THREE.Mesh(torsoGeo, bodyMat)
  torso.position.y = 0.8 + 0.8
  torso.castShadow = true
  g.add(torso)

  // Cape derrière
  const capeGeo = new THREE.PlaneGeometry(1.6, 1.8)
  disposables.push(capeGeo)
  const cape = new THREE.Mesh(capeGeo, bodyMat)
  cape.position.set(0, 1.7, -0.45)
  cape.rotation.x = -0.15
  cape.castShadow = true
  g.add(cape)

  // Tête
  const headGeo = new THREE.SphereGeometry(0.42, 16, 16)
  disposables.push(headGeo)
  const head = new THREE.Mesh(headGeo, bodyMat)
  head.position.y = 0.8 + 1.6 + 0.5
  head.castShadow = true
  g.add(head)

  // Halo (anneau au sol qui pulse)
  const haloGeo = new THREE.RingGeometry(RING_INNER, RING_OUTER, 32)
  disposables.push(haloGeo)
  const haloMat = new THREE.MeshBasicMaterial({
    color: tint,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  disposables.push(haloMat)
  const halo = new THREE.Mesh(haloGeo, haloMat)
  halo.rotation.x = -Math.PI / 2
  halo.position.y = 0.02
  g.add(halo)

  // Lumière douce qui pulse
  const light = new THREE.PointLight(tint, 1.2, 8, 2)
  light.position.y = 2.2
  g.add(light)

  // Plaque avec le nom
  const plaqueTex = makePlaqueTexture(hero.alias || hero.name, hero.side)
  disposables.push(plaqueTex)
  const plaqueMat = new THREE.MeshBasicMaterial({ map: plaqueTex, transparent: true, side: THREE.DoubleSide })
  disposables.push(plaqueMat)
  const plaqueGeo = new THREE.PlaneGeometry(1.8, 0.7)
  disposables.push(plaqueGeo)
  const plaque = new THREE.Mesh(plaqueGeo, plaqueMat)
  plaque.position.set(0, 0.55, 1.45)
  g.add(plaque)

  // Photo en panneau (si dispo)
  if (hero.photo_url) {
    const photoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide })
    disposables.push(photoMat)
    const photoGeo = new THREE.PlaneGeometry(1.4, 1.8)
    disposables.push(photoGeo)
    const photo = new THREE.Mesh(photoGeo, photoMat)
    photo.position.set(0, 1.9, 0.78)
    g.add(photo)
    texLoader.load(
      hero.photo_url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        photoMat.map = tex
        photoMat.needsUpdate = true
        disposables.push(tex)
      },
      undefined,
      () => {/* silently ignore load errors */},
    )
  }

  return { group: g, haloMat, light }
}

export function createHeroStatues(heroes, { origin = new THREE.Vector3(0, 0, -10), maxCount = 8 } = {}) {
  const root = new THREE.Group()
  root.position.copy(origin)
  const disposables = []
  const statues = []

  // Trier : featured d'abord, puis sort_order
  const sorted = [...(heroes || [])]
    .sort((a, b) => {
      const af = a.featured ? 0 : 1
      const bf = b.featured ? 0 : 1
      if (af !== bf) return af - bf
      const ao = a.sort_order ?? 999
      const bo = b.sort_order ?? 999
      return ao - bo
    })
    .slice(0, maxCount)

  if (sorted.length === 0) {
    // Pas de héros : on retourne un groupe vide (le hub charge sans erreur)
    return {
      group: root,
      statues,
      animate: () => {},
      dispose: () => { for (const d of disposables) d.dispose?.() },
      obstacles: [],
    }
  }

  // ================================================================
  //  All&eacute;e des H&eacute;ros : statues par paires se faisant face
  //  L'all&eacute;e court vers le nord (-Z) depuis le spawn
  // ================================================================
  const N = sorted.length
  const numPairs = Math.ceil(N / 2)
  const PAIR_SPACING = 6     // distance entre 2 paires successives le long de l'all&eacute;e
  const SIDE_OFFSET = 4      // distance lat&eacute;rale d'une statue par rapport &agrave; l'axe central
  const ALLEY_WIDTH = 7
  const ENTRY_PAD = 4        // plat espace devant la 1re paire
  const EXIT_PAD = 5         // espace derri&egrave;re la derni&egrave;re paire

  const alleyLength = ENTRY_PAD + (numPairs - 1) * PAIR_SPACING + EXIT_PAD
  const alleyCenterZ = -alleyLength / 2

  // Pavement central de l'all&eacute;e (rectangle long)
  const pathGeo = new THREE.PlaneGeometry(ALLEY_WIDTH, alleyLength)
  disposables.push(pathGeo)
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x52575f, roughness: 0.95, metalness: 0.05 })
  disposables.push(pathMat)
  const path = new THREE.Mesh(pathGeo, pathMat)
  path.rotation.x = -Math.PI / 2
  path.position.set(0, 0.02, alleyCenterZ)
  path.receiveShadow = true
  root.add(path)

  // Bordures lumineuses le long de l'all&eacute;e (deux fines lignes dor&eacute;es)
  const borderGeo = new THREE.PlaneGeometry(0.18, alleyLength)
  disposables.push(borderGeo)
  const borderMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.55 })
  disposables.push(borderMat)
  for (const xb of [-ALLEY_WIDTH / 2 + 0.1, ALLEY_WIDTH / 2 - 0.1]) {
    const border = new THREE.Mesh(borderGeo, borderMat)
    border.rotation.x = -Math.PI / 2
    border.position.set(xb, 0.04, alleyCenterZ)
    root.add(border)
  }

  // Arche d'entr&eacute;e (deux piliers + linteau) au sud de l'all&eacute;e
  const pillarGeo = new THREE.BoxGeometry(0.6, 5, 0.6)
  disposables.push(pillarGeo)
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.9 })
  disposables.push(pillarMat)
  for (const xp of [-ALLEY_WIDTH / 2 - 0.4, ALLEY_WIDTH / 2 + 0.4]) {
    const p = new THREE.Mesh(pillarGeo, pillarMat)
    p.position.set(xp, 2.5, 0.3)
    p.castShadow = true
    root.add(p)
  }
  const lintelGeo = new THREE.BoxGeometry(ALLEY_WIDTH + 1.6, 0.5, 0.6)
  disposables.push(lintelGeo)
  const lintel = new THREE.Mesh(lintelGeo, pillarMat)
  lintel.position.set(0, 5.2, 0.3)
  lintel.castShadow = true
  root.add(lintel)

  // Lampes hautes entre chaque paire (cylindre + sph&egrave;re &eacute;missive)
  const lampPostGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.6, 8)
  disposables.push(lampPostGeo)
  const lampPostMat = new THREE.MeshStandardMaterial({ color: 0x222730, roughness: 0.7, metalness: 0.5 })
  disposables.push(lampPostMat)
  const lampBulbGeo = new THREE.SphereGeometry(0.22, 12, 12)
  disposables.push(lampBulbGeo)
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe9a8, emissive: 0xffd070, emissiveIntensity: 1.2, roughness: 0.4,
  })
  disposables.push(lampBulbMat)

  const obstacles = []

  for (let i = 0; i < N; i++) {
    const pairIdx = Math.floor(i / 2)
    const isLeft = i % 2 === 0
    const sx = isLeft ? -SIDE_OFFSET : SIDE_OFFSET
    const sz = -ENTRY_PAD - pairIdx * PAIR_SPACING

    const hero = sorted[i]
    const { group, haloMat, light } = makeStatueGroup(hero, disposables)
    group.position.set(sx, 0, sz)
    // La statue regarde l'axe central : forward local = +Z doit pointer vers (0, *, sz)
    // direction d&eacute;sir&eacute;e = (-sx, 0, 0). Pour x=-4 → (+1,0,0) → rotation.y = +π/2
    //                                  Pour x=+4 → (-1,0,0) → rotation.y = -π/2
    group.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2
    root.add(group)

    // Lampe entre les paires (entre le pair pr&eacute;c&eacute;dent et l'actuel) — c&ocirc;t&eacute; alley
    if (isLeft && pairIdx > 0) {
      const lampZ = sz + PAIR_SPACING / 2
      for (const lx of [-ALLEY_WIDTH / 2 - 0.3, ALLEY_WIDTH / 2 + 0.3]) {
        const post = new THREE.Mesh(lampPostGeo, lampPostMat)
        post.position.set(lx, 1.8, lampZ)
        post.castShadow = true
        root.add(post)
        const bulb = new THREE.Mesh(lampBulbGeo, lampBulbMat)
        bulb.position.set(lx, 3.65, lampZ)
        root.add(bulb)
      }
    }

    const worldX = origin.x + sx
    const worldZ = origin.z + sz
    const obstacle = {
      minX: worldX - 1.5, maxX: worldX + 1.5,
      minZ: worldZ - 1.5, maxZ: worldZ + 1.5,
    }
    obstacles.push(obstacle)
    statues.push({
      id: hero.id,
      name: hero.alias || hero.name,
      worldX,
      worldZ,
      haloMat,
      light,
      obstacle,
    })
  }

  // Plaza de fond : petit cercle pav&eacute; au bout de l'all&eacute;e
  const endPlazaGeo = new THREE.CircleGeometry(5, 24)
  disposables.push(endPlazaGeo)
  const endPlaza = new THREE.Mesh(endPlazaGeo, pathMat)
  endPlaza.rotation.x = -Math.PI / 2
  endPlaza.position.set(0, 0.025, -ENTRY_PAD - (numPairs - 1) * PAIR_SPACING - 2)
  endPlaza.receiveShadow = true
  root.add(endPlaza)

  function animate(t) {
    const pulse = (Math.sin(t * 1.6) + 1) / 2
    for (const s of statues) {
      s.haloMat.opacity = 0.3 + pulse * 0.35
      s.light.intensity = 0.8 + pulse * 0.8
    }
  }

  function dispose() {
    for (const d of disposables) d.dispose?.()
  }

  return { group: root, statues, animate, dispose, obstacles }
}
