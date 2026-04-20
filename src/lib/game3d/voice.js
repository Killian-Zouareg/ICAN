const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

export class VoiceManager {
  constructor({ myId, onSignal, onRemoteStream, onRemoteEnd }) {
    this.myId = myId
    this.onSignal = onSignal
    this.onRemoteStream = onRemoteStream
    this.onRemoteEnd = onRemoteEnd
    this.peers = new Map()
    this.localStream = null
    this.started = false
    this.muted = false
  }

  async start() {
    if (this.started) return
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    })
    this.started = true
    if (this.muted) this._applyMute()
  }

  isActive() { return this.started }

  setMuted(muted) {
    this.muted = muted
    this._applyMute()
  }

  _applyMute() {
    if (!this.localStream) return
    for (const t of this.localStream.getAudioTracks()) t.enabled = !this.muted
  }

  _createPeer(peerId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const entry = { pc, pendingIce: [], hasRemote: false }
    this.peers.set(peerId, entry)

    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream)
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) this.onSignal(peerId, 'ice', e.candidate.toJSON())
    }
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track])
      this.onRemoteStream(peerId, stream)
    }
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        this.onRemoteEnd(peerId)
      }
    }
    return entry
  }

  async addPeer(peerId) {
    if (!this.started || this.peers.has(peerId)) return
    const initiator = this.myId < peerId
    const entry = this._createPeer(peerId)
    if (initiator) {
      try {
        const offer = await entry.pc.createOffer()
        await entry.pc.setLocalDescription(offer)
        this.onSignal(peerId, 'offer', entry.pc.localDescription)
      } catch { /* ignore */ }
    }
  }

  async handleSignal(from, kind, payload) {
    if (!this.started) return
    let entry = this.peers.get(from)
    if (!entry) entry = this._createPeer(from)
    const pc = entry.pc
    try {
      if (kind === 'offer') {
        await pc.setRemoteDescription(payload)
        entry.hasRemote = true
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        this.onSignal(from, 'answer', pc.localDescription)
        for (const ic of entry.pendingIce) await pc.addIceCandidate(ic)
        entry.pendingIce = []
      } else if (kind === 'answer') {
        await pc.setRemoteDescription(payload)
        entry.hasRemote = true
        for (const ic of entry.pendingIce) await pc.addIceCandidate(ic)
        entry.pendingIce = []
      } else if (kind === 'ice') {
        if (entry.hasRemote) await pc.addIceCandidate(payload)
        else entry.pendingIce.push(payload)
      }
    } catch { /* ignore signalling race conditions */ }
  }

  removePeer(peerId) {
    const entry = this.peers.get(peerId)
    if (!entry) return
    try { entry.pc.close() } catch { /* ignore */ }
    this.peers.delete(peerId)
    this.onRemoteEnd(peerId)
  }

  stop() {
    for (const id of [...this.peers.keys()]) this.removePeer(id)
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop()
      this.localStream = null
    }
    this.started = false
  }
}
