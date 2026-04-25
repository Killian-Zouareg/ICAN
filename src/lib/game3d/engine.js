import * as THREE from 'three'
import { Sky } from 'three-stdlib'
import { createAvatar } from './avatars.js'
import { createCampus, CAMPUS_HALF } from './campus.js'
import { createPedestrians } from './pedestrians.js'
import { createParkour } from './parkour.js'
import { createHeroStatues } from './heroStatues.js'
import { createCinema } from './cinema.js'

const CITY_HALF = CAMPUS_HALF

const MOVE_SPEED = 5.5
const PLAYER_RADIUS = 0.5
const CAM_DISTANCE = 5
const CAM_HEIGHT = 2.2
const MOUSE_SENS = 0.0025
const PITCH_MIN = -1.2
const PITCH_MAX = 0.6
const CAR_CAM_DISTANCE = 9
const CAR_CAM_HEIGHT = 4
const CAR_ACCEL = 9
const CAR_MAX_SPEED = 18
const CAR_REVERSE_MAX = 8
const CAR_DRAG = 0.92
const CAR_BRAKE = 14
const CAR_TURN_RATE = 2.0
// Bike-specific physics (nimbler, lower top speed)
const BIKE_CAM_DISTANCE = 5.5
const BIKE_CAM_HEIGHT = 2.6
const BIKE_ACCEL = 12
const BIKE_MAX_SPEED = 14
const BIKE_REVERSE_MAX = 5
const BIKE_DRAG = 0.95
const BIKE_BRAKE = 18
const BIKE_TURN_RATE = 3.2
const INTERACT_DIST = 4

// --- Parkour / jump physics ---
const GRAVITY = 22           // m/s^2
const JUMP_V = 8.8           // m/s
const SLIME_V = 15.5
const MAX_FALL = 30
const PLAYER_HEIGHT = 1.8    // used for ceiling / lateral platform checks
const ICE_DAMPING = 0.96     // per-frame friction multiplier on ice
const AIR_CONTROL = 0.55     // movement effectiveness while airborne

export class GameEngine {
  constructor(canvas, { localProfile, onMove, onHintChange, onParkourEvent, onStatueInteract, heroes } = {}) {
    this.canvas = canvas
    this.onMove = onMove || (() => {})
    this.onHintChange = onHintChange || (() => {})
    this.onParkourEvent = onParkourEvent || (() => {})
    this.onStatueInteract = onStatueInteract || (() => {})
    this._heroes = heroes || []
    this.remotes = new Map()
    this.keys = { forward: false, back: false, left: false, right: false, jumpHeld: false }
    this.disposed = false
    this.vy = 0
    this.onGround = true
    this.onIce = false
    this.velXZ = new THREE.Vector2(0, 0) // for ice sliding momentum
    this.parkour = null
    const savedBest = parseFloat(localStorage.getItem('parkour_best_ms') || 'NaN')
    this.parkourStats = { deaths: 0, startedAt: null, finished: false, bestMs: isNaN(savedBest) ? null : savedBest, currentCp: 0 }
    this._lastBouncedId = -1
    this.lastMoveSent = 0
    this.lastPos = new THREE.Vector3()
    this.lastRot = 0
    this.locked = false
    this.yaw = 0
    this.pitch = -0.2
    this._lockListeners = []
    this.drive = null
    this.currentHint = null

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
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
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
    this.scene.fog = new THREE.Fog(0xbfd7e8, 120, 450)

    // Procedural sky
    this.sky = new Sky()
    this.sky.scale.setScalar(1000)
    const skyU = this.sky.material.uniforms
    skyU.turbidity.value = 6
    skyU.rayleigh.value = 1.2
    skyU.mieCoefficient.value = 0.006
    skyU.mieDirectionalG.value = 0.85
    const sunPos = new THREE.Vector3()
    const phi = THREE.MathUtils.degToRad(90 - 45)
    const theta = THREE.MathUtils.degToRad(40)
    sunPos.setFromSphericalCoords(1, phi, theta)
    skyU.sunPosition.value.copy(sunPos)
    this.scene.add(this.sky)

    const ambient = new THREE.AmbientLight(0xffffff, 0.45)
    this.scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.2)
    sun.position.copy(sunPos).multiplyScalar(80)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -80
    sun.shadow.camera.right = 80
    sun.shadow.camera.top = 80
    sun.shadow.camera.bottom = -80
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 300
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    this.scene.add(sun)
    this.scene.add(sun.target)
    this.sun = sun

    const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x3a5a2a, 0.35)
    this.scene.add(hemi)

    const campus = createCampus()
    this.scene.add(campus.root)
    this._disposables = campus.disposables
    this.obstacles = campus.obstacles
    this.cars = campus.cars
    this._campusAnimate = campus.root.userData.animate

    // Parkour (au sud-est du campus, hors des b&acirc;timents)
    const parkour = createParkour({ origin: new THREE.Vector3(130, 0, 130) })
    this.scene.add(parkour.root)
    this.parkour = parkour
    this._parkourReachedCps = new Set([0])
    this._disposables.push(...parkour.disposables)

    // Place des L&eacute;gendes : statues des h&eacute;ros wiki au nord du spawn
    this.heroStatues = createHeroStatues(this._heroes, {
      origin: new THREE.Vector3(0, 0, -25),
    })
    this.scene.add(this.heroStatues.group)
    if (this.heroStatues.obstacles?.length) {
      this.obstacles.push(...this.heroStatues.obstacles)
    }

    // iCINEMA : b&acirc;timent au nord-ouest, &eacute;cran g&eacute;ant avec GIF
    this.cinema = createCinema({ origin: new THREE.Vector3(-95, 0, -40) })
    this.scene.add(this.cinema.group)
    if (this.cinema.obstacles?.length) {
      this.obstacles.push(...this.cinema.obstacles)
    }

    this.pedestrians = createPedestrians({
      count: 28,
      obstacles: this.obstacles,
      halfWorld: CITY_HALF,
      seed: 1337,
    })
    this.pedestrians.group.traverse((n) => { if (n.isMesh) { n.castShadow = true } })
    this.scene.add(this.pedestrians.group)

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 500)
    this._resize()
  }

  _collides(x, z, y = null) {
    const r = PLAYER_RADIUS
    // 2D obstacles (campus buildings, trees, cars) — always block
    for (const o of this.obstacles) {
      if (x + r > o.minX && x - r < o.maxX && z + r > o.minZ && z - r < o.maxZ) return true
    }
    // 3D platforms (parkour) — block laterally only when Y-range overlaps
    if (this.parkour && y !== null) {
      const py = y
      const pyTop = y + PLAYER_HEIGHT
      for (const p of this.parkour.platforms) {
        if (p._inactive) continue
        if (
          x + r > p.minX && x - r < p.maxX &&
          z + r > p.minZ && z - r < p.maxZ &&
          pyTop > p.minY + 0.05 && py < p.maxY - 0.05 &&
          p.maxY - py > 0.5 // step-up: don't block if platform top is within 0.5m of feet
        ) return true
      }
    }
    return false
  }

  _tryMove(nx, nz) {
    // No world boundary clamp — the player can roam beyond the campus edge.
    const cur = this.player.position
    const x = nx
    const z = nz
    const y = cur.y
    if (!this._collides(x, z, y)) {
      cur.x = x; cur.z = z
      return
    }
    if (!this._collides(x, cur.z, y)) { cur.x = x; return }
    if (!this._collides(cur.x, z, y)) { cur.z = z; return }
  }

  _carCollides(nx, nz) {
    const halfW = 1.2
    const halfL = 2.2
    for (const o of this.obstacles) {
      if (this.drive && o === this.drive.obstacle) continue
      if (nx + halfW > o.minX && nx - halfW < o.maxX && nz + halfL > o.minZ && nz - halfL < o.maxZ) return true
    }
    return false
  }

  _nearestCar() {
    if (!this.cars?.length) return null
    let best = null
    let bestDist = INTERACT_DIST
    const px = this.player.position.x
    const pz = this.player.position.z
    for (const c of this.cars) {
      const d = Math.hypot(c.group.position.x - px, c.group.position.z - pz)
      if (d < bestDist) { best = c; bestDist = d }
    }
    return best
  }

  _nearestStatue() {
    const list = this.heroStatues?.statues
    if (!list?.length) return null
    let best = null
    let bestDist = INTERACT_DIST
    const px = this.player.position.x
    const pz = this.player.position.z
    for (const s of list) {
      const d = Math.hypot(s.worldX - px, s.worldZ - pz)
      if (d < bestDist) { best = s; bestDist = d }
    }
    return best
  }

  _setHint(hint) {
    if (this.currentHint !== hint) {
      this.currentHint = hint
      this.onHintChange(hint)
    }
  }

  _onInteract() {
    if (this.drive) { this.exitCar(); return }
    const statue = this._nearestStatue()
    if (statue) {
      this.onStatueInteract({ id: statue.id, name: statue.name })
      return
    }
    const car = this._nearestCar()
    if (car) this.enterCar(car)
  }

  enterCar(carData) {
    if (this.drive) return
    const idx = this.obstacles.indexOf(carData.obstacle)
    if (idx >= 0) this.obstacles.splice(idx, 1)
    this.drive = {
      car: carData.group,
      data: carData,
      obstacle: carData.obstacle,
      speed: 0,
      heading: carData.group.rotation.y,
      type: carData.vehicleType || 'car',
    }
    if (this.drive.type === 'bike') {
      // On a bike the rider is visible, sitting on the seat
      this.player.visible = true
    } else {
      this.player.visible = false
    }
    this._setHint(this.drive.type === 'bike' ? 'exit-bike' : 'exit-car')
  }

  exitCar() {
    if (!this.drive) return
    const car = this.drive.car
    const isBike = this.drive.type === 'bike'
    if (isBike) car.rotation.z = 0

    const heading = this.drive.heading
    const cosA = Math.abs(Math.cos(heading))
    const sinA = Math.abs(Math.sin(heading))
    const w = this.drive.data.width
    const l = this.drive.data.length
    const halfW = (cosA * w + sinA * l) / 2
    const halfL = (sinA * w + cosA * l) / 2

    // Pousse le joueur dans la direction lat&eacute;rale du v&eacute;hicule, hors de l'AABB rot&eacute;e.
    // L'ancien offset fixe (1.8) pla&ccedil;ait le joueur DANS la collision quand le v&eacute;hicule
    // &eacute;tait orient&eacute; en diagonale (halfW peut atteindre ~2.12m &agrave; 45&deg;) → bloqu&eacute;.
    const dirX = Math.cos(heading)
    const dirZ = -Math.sin(heading)
    const projHalf = Math.abs(dirX) * halfW + Math.abs(dirZ) * halfL
    const exitDist = projHalf + PLAYER_RADIUS + 0.3

    this.player.position.set(
      car.position.x + dirX * exitDist,
      0,
      car.position.z + dirZ * exitDist,
    )
    this.vy = 0
    this.velXZ.set(0, 0)
    this.onGround = true
    this.onIce = false

    const newObstacle = {
      minX: car.position.x - halfW,
      maxX: car.position.x + halfW,
      minZ: car.position.z - halfL,
      maxZ: car.position.z + halfL,
    }
    this.drive.data.obstacle = newObstacle
    this.obstacles.push(newObstacle)
    this.player.visible = true
    this.drive = null
    this._setHint(null)
  }

  _setupLocalPlayer(profile) {
    const p = profile || { id: 'local', username: 'me', avatar_url: null }
    this.player = createAvatar({
      profileId: p.id,
      username: p.username,
      avatarUrl: p.avatar_url,
    })
    // Spawn on the south path, looking north toward the library
    this.player.position.set(0, 0, 22)
    this.player.rotation.y = Math.PI
    this.yaw = 0
    this.player.traverse((n) => { if (n.isMesh) { n.castShadow = true } })
    this.scene.add(this.player)
    this._updateCamera()
  }

  _updateCamera() {
    const target = this.drive ? this.drive.car.position : this.player.position
    const isBike = this.drive?.type === 'bike'
    const dist = this.drive ? (isBike ? BIKE_CAM_DISTANCE : CAR_CAM_DISTANCE) : CAM_DISTANCE
    const height = this.drive ? (isBike ? BIKE_CAM_HEIGHT : CAR_CAM_HEIGHT) : CAM_HEIGHT
    const lookY = this.drive ? (isBike ? 1.3 : 1.0) : 1.7
    const cosP = Math.cos(this.pitch)
    const sinP = Math.sin(this.pitch)
    const ox = Math.sin(this.yaw) * dist * cosP
    const oz = Math.cos(this.yaw) * dist * cosP
    const oy = height + dist * -sinP
    this.camera.position.set(target.x + ox, target.y + oy, target.z + oz)
    this.camera.lookAt(target.x, target.y + lookY, target.z)
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
        case 'KeyE': if (!e.repeat) this._onInteract(); break
        case 'Space':
          e.preventDefault?.()
          this.keys.jumpHeld = true
          if (!e.repeat && !this.drive) this._tryJump()
          break
        case 'KeyR': if (!e.repeat) this._parkourRespawn(); break
      }
    }
    this._onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': case 'KeyZ': this.keys.forward = false; break
        case 'KeyS': case 'ArrowDown': this.keys.back = false; break
        case 'KeyA': case 'ArrowLeft': case 'KeyQ': this.keys.left = false; break
        case 'KeyD': case 'ArrowRight': this.keys.right = false; break
        case 'Space':
          this.keys.jumpHeld = false
          // Variable jump height: cut upward velocity when released
          if (this.vy > 3) this.vy = 3
          break
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

  _tryJump() {
    if (this.onGround) {
      this.vy = JUMP_V
      this.onGround = false
    }
  }

  _parkourRespawn(silent = false) {
    if (!this.parkour) return
    // Find last reached checkpoint
    let spawn = this.parkour.spawnPoint
    let highest = -1
    for (const cp of this.parkour.checkpoints) {
      if (this._parkourReachedCps.has(cp.index) && cp.index > highest) {
        highest = cp.index
        spawn = cp.pos
      }
    }
    this.player.position.copy(spawn)
    this.vy = 0
    this.velXZ.set(0, 0)
    this.onGround = true
    if (!silent) {
      this.parkourStats.deaths++
      this.onParkourEvent({ type: 'death', deaths: this.parkourStats.deaths, cp: highest })
    }
  }

  _isInParkourZone(x, z) {
    const b = this.parkour?.worldBounds
    if (!b) return false
    return x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ
  }

  _updateParkourPhysics(dt) {
    if (!this.parkour) return
    const px = this.player.position.x
    const py = this.player.position.y
    const pz = this.player.position.z
    const r = PLAYER_RADIUS

    // Gravity
    this.vy -= GRAVITY * dt
    if (this.vy < -MAX_FALL) this.vy = -MAX_FALL

    let newY = py + this.vy * dt

    // Vertical collision — landing on platform tops / head-hit under ceilings
    let landed = null
    if (this.vy <= 0) {
      let bestTop = null
      for (const p of this.parkour.platforms) {
        if (p._inactive) continue
        if (px + r <= p.minX || px - r >= p.maxX) continue
        if (pz + r <= p.minZ || pz - r >= p.maxZ) continue
        const top = p.maxY
        // Must be at or above this top (with a small step-up slack), falling onto it
        if (py + 0.5 >= top && newY <= top) {
          if (bestTop === null || top > bestTop.top) {
            bestTop = { top, plat: p }
          }
        }
      }
      if (bestTop) {
        landed = bestTop.plat
        newY = bestTop.top
        this.vy = 0
        // Ride moving platforms
        if (landed.type === 'moving') {
          if (landed._dx) this.player.position.x += landed._dx
          if (landed._dz) this.player.position.z += landed._dz
          if (landed._dy) newY += landed._dy
        }
      }
    } else {
      // Head hit
      for (const p of this.parkour.platforms) {
        if (p._inactive) continue
        if (px + r <= p.minX || px - r >= p.maxX) continue
        if (pz + r <= p.minZ || pz - r >= p.maxZ) continue
        const bottom = p.minY
        if (py + PLAYER_HEIGHT <= bottom + 0.01 && newY + PLAYER_HEIGHT > bottom) {
          newY = bottom - PLAYER_HEIGHT - 0.01
          this.vy = -0.5
          break
        }
      }
    }

    // Ground (grass) at y=0 — keep player on ground outside parkour
    if (newY <= 0 && !landed) {
      newY = 0
      this.vy = 0
      landed = { type: 'ground' }
    }

    this.player.position.y = newY

    this.onGround = !!landed
    this.onIce = landed?.type === 'ice'

    // Slime bounce
    if (landed?.type === 'slime') {
      // avoid re-bouncing the same frame chain: fresh impulse each landing
      this.vy = SLIME_V
      this.onGround = false
    }

    // Fall below world → respawn
    if (newY < this.parkour.fallY && this._isInParkourZone(px, pz)) {
      this._parkourRespawn()
      return
    }

    // Hazards (lava pit / spikes)
    for (const h of this.parkour.hazards) {
      if (
        px + r > h.minX && px - r < h.maxX &&
        pz + r > h.minZ && pz - r < h.maxZ &&
        newY < h.maxY && newY + PLAYER_HEIGHT > h.minY
      ) {
        this._parkourRespawn()
        return
      }
    }

    // Checkpoints
    for (const cp of this.parkour.checkpoints) {
      if (this._parkourReachedCps.has(cp.index)) continue
      const d = Math.hypot(cp.pos.x - px, cp.pos.z - pz)
      if (d < 1.5 && Math.abs(cp.pos.y - newY) < 3) {
        this._parkourReachedCps.add(cp.index)
        this.parkourStats.currentCp = cp.index
        // Visual feedback: flash flag larger (handled by the store/UI)
        this.onParkourEvent({ type: 'checkpoint', index: cp.index })
      }
    }

    // Goal
    const g = this.parkour.goal._worldAabb
    if (
      !this.parkourStats.finished &&
      px + r > g.minX && px - r < g.maxX &&
      pz + r > g.minZ && pz - r < g.maxZ &&
      newY < g.maxY + 1 && newY + PLAYER_HEIGHT > g.minY
    ) {
      this.parkourStats.finished = true
      const ms = this.parkourStats.startedAt ? performance.now() - this.parkourStats.startedAt : 0
      if (this.parkourStats.bestMs === null || ms < this.parkourStats.bestMs) {
        this.parkourStats.bestMs = ms
        localStorage.setItem('parkour_best_ms', String(ms))
      }
      this.onParkourEvent({ type: 'finish', ms, deaths: this.parkourStats.deaths })
    }
  }

  updateParkourLeaderboard(entries) {
    this.parkour?.updateLeaderboard?.(entries)
  }

  resetParkour() {
    if (!this.parkour) return
    this._parkourReachedCps = new Set([0])
    this.parkourStats = { deaths: 0, startedAt: performance.now(), finished: false, bestMs: this.parkourStats.bestMs, currentCp: 0 }
    this._parkourRespawn(true)
    this.onParkourEvent({ type: 'reset' })
  }

  _tick() {
    if (this.disposed) return
    const dt = Math.min(this.clock.getDelta(), 0.1)

    let walking = false
    if (this.drive) {
      const d = this.drive
      const isBike = d.type === 'bike'
      const ACCEL = isBike ? BIKE_ACCEL : CAR_ACCEL
      const MAX_SP = isBike ? BIKE_MAX_SPEED : CAR_MAX_SPEED
      const REV_MAX = isBike ? BIKE_REVERSE_MAX : CAR_REVERSE_MAX
      const DRAG = isBike ? BIKE_DRAG : CAR_DRAG
      const BRAKE = isBike ? BIKE_BRAKE : CAR_BRAKE
      const TURN = isBike ? BIKE_TURN_RATE : CAR_TURN_RATE
      const accelInput = (this.keys.forward ? 1 : 0) - (this.keys.back ? 1 : 0)
      const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0)
      if (accelInput !== 0) {
        d.speed += accelInput * ACCEL * dt
      } else {
        const drag = Math.pow(DRAG, dt * 60)
        d.speed *= drag
        if (Math.abs(d.speed) < 0.05) d.speed = 0
      }
      if (this.keys.forward && d.speed < 0) d.speed += BRAKE * dt
      if (this.keys.back && d.speed > 0) d.speed -= BRAKE * dt
      if (d.speed > MAX_SP) d.speed = MAX_SP
      if (d.speed < -REV_MAX) d.speed = -REV_MAX

      const speedFactor = Math.min(1, Math.abs(d.speed) / 5)
      const dir = d.speed >= 0 ? 1 : -1
      d.heading += steerInput * TURN * speedFactor * dir * dt

      const dx = Math.sin(d.heading) * d.speed * dt
      const dz = Math.cos(d.heading) * d.speed * dt
      // No world boundary clamp on cars either.
      const nx = d.car.position.x + dx
      const nz = d.car.position.z + dz
      if (!this._carCollides(nx, nz)) {
        d.car.position.x = nx
        d.car.position.z = nz
      } else {
        d.speed *= -0.25
      }
      d.car.rotation.y = d.heading
      this.player.position.copy(d.car.position)
      if (isBike) {
        // Rider sits on the seat
        this.player.position.y = 0.8
        // Lean on turns for visual flair
        d.car.rotation.z = -steerInput * Math.min(0.25, Math.abs(d.speed) / 30)
      }
      this.player.rotation.y = d.heading
    } else if (this.locked) {
      let mx = 0, mz = 0
      if (this.keys.forward) mz -= 1
      if (this.keys.back) mz += 1
      if (this.keys.left) mx -= 1
      if (this.keys.right) mx += 1
      let wx = 0, wz = 0
      if (mx !== 0 || mz !== 0) {
        walking = true
        const len = Math.hypot(mx, mz)
        mx /= len; mz /= len
        const sin = Math.sin(this.yaw)
        const cos = Math.cos(this.yaw)
        wx = mx * cos + mz * sin
        wz = -mx * sin + mz * cos
      }

      // Movement model mixes direct control and momentum (ice / air)
      const targetX = wx * MOVE_SPEED
      const targetZ = wz * MOVE_SPEED
      if (this.onGround && !this.onIce) {
        // Direct, responsive walking
        this.velXZ.x = targetX
        this.velXZ.y = targetZ
      } else if (this.onIce) {
        // Ice: small accel, low friction
        this.velXZ.x = this.velXZ.x * ICE_DAMPING + targetX * 0.03
        this.velXZ.y = this.velXZ.y * ICE_DAMPING + targetZ * 0.03
      } else {
        // Air: reduced control, keep momentum
        this.velXZ.x = this.velXZ.x * 0.98 + targetX * AIR_CONTROL * 0.1
        this.velXZ.y = this.velXZ.y * 0.98 + targetZ * AIR_CONTROL * 0.1
      }

      if (Math.hypot(this.velXZ.x, this.velXZ.y) > 0.05) {
        this._tryMove(
          this.player.position.x + this.velXZ.x * dt,
          this.player.position.z + this.velXZ.y * dt,
        )
        const facing = Math.atan2(this.velXZ.x, this.velXZ.y) + Math.PI
        const rotDelta = ((facing - this.player.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI
        this.player.rotation.y += rotDelta * Math.min(1, dt * 12)
      }
    }
    this.player.userData.animate?.(dt, walking)

    if (!this.drive) {
      const statue = this._nearestStatue()
      if (statue) {
        this._setHint(`view-hero:${statue.name}`)
      } else {
        const near = this._nearestCar()
        this._setHint(near ? (near.vehicleType === 'bike' ? 'enter-bike' : 'enter-car') : null)
      }
    }

    this.pedestrians?.update(dt, performance.now())
    this._campusAnimate?.(this.clock.elapsedTime)
    this.parkour?.animate(this.clock.elapsedTime)
    this.heroStatues?.animate(this.clock.elapsedTime)
    this.cinema?.animate(this.clock.elapsedTime)

    // Parkour physics (gravity, platform collision, hazards, checkpoints, goal)
    if (!this.drive) {
      this._updateParkourPhysics(dt)
      // Start timer the first time the player enters the parkour zone
      if (
        this.parkourStats.startedAt === null &&
        this._isInParkourZone(this.player.position.x, this.player.position.z)
      ) {
        this.parkourStats.startedAt = performance.now()
        this.onParkourEvent({ type: 'start' })
      }
    }

    // Keep the sun's shadow frustum focused on the player
    if (this.sun) {
      const tx = this.drive ? this.drive.car.position.x : this.player.position.x
      const tz = this.drive ? this.drive.car.position.z : this.player.position.z
      this.sun.target.position.set(tx, 0, tz)
      this.sun.position.set(tx + 40, 80, tz + 25)
    }

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
      mesh.position.set(x ?? 0, y ?? 0, z ?? 0)
      mesh.traverse((n) => { if (n.isMesh) { n.castShadow = true } })
      this.scene.add(mesh)
      entry = { mesh, target: new THREE.Vector3(x ?? 0, y ?? 0, z ?? 0), targetRot: rot ?? 0 }
      this.remotes.set(profileId, entry)
    }
    if (typeof x === 'number') entry.target.set(x, y ?? 0, z)
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
    if (this.pedestrians) {
      this.scene.remove(this.pedestrians.group)
      this.pedestrians.dispose()
    }
    if (this.heroStatues) {
      this.scene.remove(this.heroStatues.group)
      this.heroStatues.dispose()
    }
    if (this.cinema) {
      this.scene.remove(this.cinema.group)
      this.cinema.dispose()
    }
    for (const d of this._disposables) d.dispose?.()
    this.renderer.dispose()
  }
}
