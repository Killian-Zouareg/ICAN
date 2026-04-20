import * as THREE from 'three'

const textureLoader = new THREE.TextureLoader()
textureLoader.crossOrigin = 'anonymous'

const HEAD_GEO = new THREE.BoxGeometry(0.55, 0.55, 0.55)
const TORSO_GEO = new THREE.BoxGeometry(0.7, 0.9, 0.4)
const LIMB_GEO = new THREE.BoxGeometry(0.22, 0.75, 0.22)
LIMB_GEO.translate(0, -0.375, 0)

const SKIN_COLOR = 0xf1d5b0

function hashColor(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const hue = Math.abs(h) % 360
  const c = new THREE.Color()
  c.setHSL(hue / 360, 0.55, 0.5)
  return c
}

function makeNametagTexture(name) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(21, 32, 43, 0.85)'
  ctx.fillRect(0, 0, 256, 64)
  ctx.strokeStyle = '#1da1f2'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, 254, 62)
  ctx.fillStyle = '#e1e8ed'
  ctx.font = 'bold 24px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('@' + name.slice(0, 16), 128, 32)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

export function createAvatar({ profileId, username, avatarUrl }) {
  const root = new THREE.Group()
  root.userData.profileId = profileId

  const shirtColor = hashColor(profileId || username || 'anon')
  const pantsColor = new THREE.Color(0x2c3e50)
  const skin = new THREE.MeshLambertMaterial({ color: SKIN_COLOR })
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor })
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor })
  const headMat = new THREE.MeshLambertMaterial({ color: SKIN_COLOR })

  const disposables = [skin, shirt, pants, headMat]

  const hipHeight = 0.9
  const shoulderHeight = hipHeight + 0.75

  const torso = new THREE.Mesh(TORSO_GEO, shirt)
  torso.position.y = hipHeight + 0.45
  root.add(torso)

  const head = new THREE.Mesh(HEAD_GEO, headMat)
  head.position.y = shoulderHeight + 0.35
  root.add(head)

  if (avatarUrl) {
    textureLoader.load(
      avatarUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        headMat.map = tex
        headMat.needsUpdate = true
      },
      undefined,
      () => { /* ignore */ },
    )
  }

  const armL = new THREE.Mesh(LIMB_GEO, shirt)
  armL.position.set(-0.46, shoulderHeight, 0)
  root.add(armL)

  const armR = new THREE.Mesh(LIMB_GEO, shirt)
  armR.position.set(0.46, shoulderHeight, 0)
  root.add(armR)

  const legL = new THREE.Mesh(LIMB_GEO, pants)
  legL.position.set(-0.18, hipHeight, 0)
  root.add(legL)

  const legR = new THREE.Mesh(LIMB_GEO, pants)
  legR.position.set(0.18, hipHeight, 0)
  root.add(legR)

  const nametagMat = new THREE.SpriteMaterial({
    map: makeNametagTexture(username || 'anon'),
    depthTest: false,
    transparent: true,
  })
  const nametag = new THREE.Sprite(nametagMat)
  nametag.scale.set(1.6, 0.4, 1)
  nametag.position.y = shoulderHeight + 1.0
  root.add(nametag)
  disposables.push(nametagMat, nametagMat.map)

  let phase = 0
  root.userData.animate = (dt, walking) => {
    const target = walking ? 1 : 0
    if (walking) phase += dt * 9
    const swing = Math.sin(phase) * 0.9 * target
    armL.rotation.x = swing
    armR.rotation.x = -swing
    legL.rotation.x = -swing
    legR.rotation.x = swing
    if (!walking) {
      armL.rotation.x *= 0.85
      armR.rotation.x *= 0.85
      legL.rotation.x *= 0.85
      legR.rotation.x *= 0.85
    }
  }

  root.userData.dispose = () => {
    for (const d of disposables) d.dispose?.()
    if (headMat.map) headMat.map.dispose()
  }

  return root
}
