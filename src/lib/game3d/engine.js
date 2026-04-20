import * as THREE from 'three'
import { createAvatar } from './avatars.js'
import { createCity, CITY_HALF } from './city.js'

const MOVE_SPEED = 5.5
const PLAYER_RADIUS = 0.5
const CAM_DISTANCE = 5
const CAM_HEIGHT = 2.2
const MOUSE_SENS = 0.0025
const PITCH_MIN = -0.9
const PITCH_MAX = 0.5

export class GameEngine {
  constructor(canvas, { localProfile, onMove } = {}) {
    this.canvas = canvas
    this.onMove = onMove || (() => {})
    this.remotes = new Map()
    this.keys = { forward: false, back: false, left: false, right: false }
    this.disposed = false
    this.lastMoveSent = 0
    this.lastPos = new THREE.Vector3()
    this.lastRot = 0
    this.locked = false
    this.yaw = 0
    this.pitch = -0.2
    this._lockListeners = []

    this._setupRenderer()
    this._setupScene()
    this._setupLocalPlayer(localProfile)
    this._setupAudio()
    this._bindInputs()

    this.clock = new THREE.Clock()
    this._tick = this._tick.bind(this)
    this.renderer.setAnimationLoop(this._tick)
    this._onResize = () => this._resize()
    window.addEventListener('resize', this._onResize)
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._resize()
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect()
    const w = rect.width || window.innerWidth
    const h = rect.height || window.innerHeight
    this.renderer.setSize(w, h, false)
    if (this.camera) {
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
  }

  _setupScene() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x9cc7d6)
    this.scene.fog = new THREE.Fog(0x9cc7d6, 60, 180)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xfff2d6, 0.95)
    sun.position.set(30, 60, 20)
    this.scene.add(sun)
    const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x3a5a2a, 0.35)
    this.scene.add(hemi)

    const city = createCity()
    this.scene.add(city.root)
    this._disposables = city.disposables
    this.obstacles = city.obstacles

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 500)
    this._resize()
  }

  _collides(x, z) {
    const r = PLAYER_RADIUS
    for (const o of this.obstacles) {
      if (x + r > o.minX && x - r < o.maxX && z + r > o.minZ && z - r < o.maxZ) return true
    }
    return false
  }

  _tryMove(nx, nz) {
    const cur = this.player.position
    const halfWorld = CITY_HALF - 1
    let x = Math.max(-halfWorld, Math.min(halfWorld, nx))
    let z = Math.max(-halfWorld, Math.min(halfWorld, nz))
    if (!this._collides(x, z)) {
      cur.x = x; cur.z = z
      return
    }
    if (!this._collides(x, cur.z)) { cur.x = x; return }
    if (!this._collides(cur.x, z)) { cur.z = z; return }
  }

  _setupLocalPlayer(profile) {
    const p = profile || { id: 'local', username: 'me', avatar_url: null }
    this.player = createAvatar({
      profileId: p.id,
      username: p.username,
      avatarUrl: p.avatar_url,
    })
    this.player.position.set(0, 0, 0)
    this.scene.add(this.player)
    this._updateCamera()
  }

  _updateCamera() {
    const cosP = Math.cos(this.pitch)
    const sinP = Math.sin(this.pitch)
    const ox = Math.sin(this.yaw) * CAM_DISTANCE * cosP
    const oz = Math.cos(this.yaw) * CAM_DISTANCE * cosP
    const oy = CAM_HEIGHT + CAM_DISTANCE * -sinP
    this.camera.position.set(
      this.player.position.x + ox,
      this.player.position.y + oy,
      this.player.position.z + oz,
    )
    this.camera.lookAt(
      this.player.position.x,
      this.player.position.y + 1.7,
      this.player.position.z,
    )
  }

  _setupAudio() {
    this.listener = new THREE.AudioListener()
    this.camera.add(this.listener)
    this.remoteAudios = new Map()
  }

  resumeAudioContext() {
    const ctx = this.listener?.context
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  }

  attachRemoteAudio(profileId, stream) {
    const entry = this.remotes.get(profileId)
    if (!entry) return
    this.detachRemoteAudio(profileId)

    const audioEl = document.createElement('audio')
    audioEl.srcObject = stream
    audioEl.muted = true
    audioEl.autoplay = true
    audioEl.playsInline = true
    audioEl.play().catch(() => {})

    const positional = new THREE.PositionalAudio(this.listener)
    positional.setMediaStreamSource(stream)
    positional.setRefDistance(3)
    positional.setMaxDistance(25)
    positional.setRolloffFactor(1.8)
    positional.setDistanceModel('linear')
    entry.mesh.add(positional)

    this.remoteAudios.set(profileId, { positional, audioEl })
  }

  detachRemoteAudio(profileId) {
    const a = this.remoteAudios.get(profileId)
    if (!a) return
    try { a.positional.parent?.remove(a.positional) } catch { /* ignore */ }
    try { a.positional.disconnect?.() } catch { /* ignore */ }
    try { a.audioEl.srcObject = null } catch { /* ignore */ }
    this.remoteAudios.delete(profileId)
  }

  _bindInputs() {
    this._onKeyDown = (e) => {
      if (!this.locked) return
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': case 'KeyZ': this.keys.forward = true; break
        case 'KeyS': case 'ArrowDown': this.keys.back = true; break
        case 'KeyA': case 'ArrowLeft': case 'KeyQ': this.keys.left = true; break
        case 'KeyD': case 'ArrowRight': this.keys.right = true; break
      }
    }
    this._onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': case 'KeyZ': this.keys.forward = false; break
        case 'KeyS': case 'ArrowDown': this.keys.back = false; break
        case 'KeyA': case 'ArrowLeft': case 'KeyQ': this.keys.left = false; break
        case 'KeyD': case 'ArrowRight': this.keys.right = false; break
      }
    }
    this._onMouseMove = (e) => {
      if (!this.locked) return
      this.yaw -= e.movementX * MOUSE_SENS
      this.pitch -= e.movementY * MOUSE_SENS
      if (this.pitch < PITCH_MIN) this.pitch = PITCH_MIN
      if (this.pitch > PITCH_MAX) this.pitch = PITCH_MAX
    }
    this._onPointerLockChange = () => {
      const wasLocked = this.locked
      this.locked = document.pointerLockElement === document.body
      if (wasLocked !== this.locked) {
        for (const cb of this._lockListeners) cb(this.locked)
      }
      if (!this.locked) {
        this.keys.forward = this.keys.back = this.keys.left = this.keys.right = false
      }
    }
    document.addEventListener('keydown', this._onKeyDown)
    document.addEventListener('keyup', this._onKeyUp)
    document.addEventListener('mousemove', this._onMouseMove)
    document.addEventListener('pointerlockchange', this._onPointerLockChange)
  }

  lock() {
    if (!document.pointerLockElement) document.body.requestPointerLock?.()
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock?.()
  }

  get isLocked() { return this.locked }

  onLockChange(cb) {
    this._lockListeners.push(cb)
  }

  _tick() {
    if (this.disposed) return
    const dt = Math.min(this.clock.getDelta(), 0.1)

    let walking = false
    if (this.locked) {
      let mx = 0, mz = 0
      if (this.keys.forward) mz -= 1
      if (this.keys.back) mz += 1
      if (this.keys.left) mx -= 1
      if (this.keys.right) mx += 1
      if (mx !== 0 || mz !== 0) {
        walking = true
        const len = Math.hypot(mx, mz)
        mx /= len; mz /= len
        const sin = Math.sin(this.yaw)
        const cos = Math.cos(this.yaw)
        const wx = mx * cos + mz * sin
        const wz = -mx * sin + mz * cos
        const step = MOVE_SPEED * dt
        this._tryMove(this.player.position.x + wx * step, this.player.position.z + wz * step)
        const facing = Math.atan2(wx, wz) + Math.PI
        const rotDelta = ((facing - this.player.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI
        this.player.rotation.y += rotDelta * Math.min(1, dt * 12)
      }
    }
    this.player.userData.animate?.(dt, walking)

    this._updateCamera()

    for (const r of this.remotes.values()) {
      const distSq = r.mesh.position.distanceToSquared(r.target)
      const remoteWalking = distSq > 0.01
      r.mesh.position.lerp(r.target, Math.min(1, dt * 10))
      const rotDelta = ((r.targetRot - r.mesh.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI
      r.mesh.rotation.y += rotDelta * Math.min(1, dt * 10)
      r.mesh.userData.animate?.(dt, remoteWalking)
    }

    this._maybeEmitMove()
    this.renderer.render(this.scene, this.camera)
  }

  _maybeEmitMove() {
    const now = performance.now()
    if (now - this.lastMoveSent < 100) return
    const pos = this.player.position
    const rot = this.player.rotation.y
    const moved = pos.distanceToSquared(this.lastPos) > 0.0004
    const rotated = Math.abs(rot - this.lastRot) > 0.02
    if (!moved && !rotated) return
    this.lastMoveSent = now
    this.lastPos.copy(pos)
    this.lastRot = rot
    this.onMove({ x: pos.x, y: pos.y, z: pos.z, rot })
  }

  upsertRemote({ profileId, username, avatarUrl, x, y, z, rot }) {
    let entry = this.remotes.get(profileId)
    if (!entry) {
      const mesh = createAvatar({ profileId, username, avatarUrl })
      mesh.position.set(x ?? 0, 0, z ?? 0)
      this.scene.add(mesh)
      entry = { mesh, target: new THREE.Vector3(x ?? 0, 0, z ?? 0), targetRot: rot ?? 0 }
      this.remotes.set(profileId, entry)
    }
    if (typeof x === 'number') entry.target.set(x, 0, z)
    if (typeof rot === 'number') entry.targetRot = rot
  }

  removeRemote(profileId) {
    const entry = this.remotes.get(profileId)
    if (!entry) return
    this.detachRemoteAudio(profileId)
    this.scene.remove(entry.mesh)
    if (entry.mesh.userData.dispose) entry.mesh.userData.dispose()
    this.remotes.delete(profileId)
  }

  dispose() {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    window.removeEventListener('resize', this._onResize)
    document.removeEventListener('keydown', this._onKeyDown)
    document.removeEventListener('keyup', this._onKeyUp)
    document.removeEventListener('mousemove', this._onMouseMove)
    document.removeEventListener('pointerlockchange', this._onPointerLockChange)
    if (document.pointerLockElement) document.exitPointerLock?.()
    for (const id of [...this.remoteAudios.keys()]) this.detachRemoteAudio(id)
    for (const id of [...this.remotes.keys()]) this.removeRemote(id)
    if (this.player?.userData.dispose) this.player.userData.dispose()
    if (this.player) this.scene.remove(this.player)
    for (const d of this._disposables) d.dispose?.()
    this.renderer.dispose()
  }
}
