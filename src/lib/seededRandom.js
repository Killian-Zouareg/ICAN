// Deterministic PRNG — mulberry32
// Given the same seed, always produces the same sequence.
export function createRng(seed) {
  let t = Number(seed) >>> 0
  if (t === 0) t = 1
  return function next() {
    t = (t + 0x6D2B79F5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// Integer in [min, max] inclusive
export function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min
}

// Pick deterministic seed from two strings
export function hashSeed(...parts) {
  let h = 2166136261
  for (const p of parts) {
    const s = String(p)
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
  }
  return h >>> 0
}
