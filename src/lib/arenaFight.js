import { createRng, randInt, hashSeed } from './seededRandom'

export const STATS = ['force', 'vigueur', 'mobilite', 'intelligence', 'charisme']
export const STAT_LABELS = {
  force: { emoji: '💪', label: 'Force' },
  vigueur: { emoji: '🛡️', label: 'Vigueur' },
  mobilite: { emoji: '🏃', label: 'Mobilité' },
  intelligence: { emoji: '🧠', label: 'Intelligence' },
  charisme: { emoji: '✨', label: 'Charisme' },
}

// Dérive les PV max à partir du stat vigueur (0-5 → 20-70)
export function computeMaxHp(sheet) {
  const vig = Number(sheet?.vigueur ?? 0)
  return 20 + vig * 10
}

// Roll for a stat: 1 à (20 + stat * 4)
function rollForStat(rng, statValue) {
  const max = 20 + Math.max(0, Math.min(5, Number(statValue || 0))) * 4
  return randInt(rng, 1, max)
}

/**
 * simulateFight — déterministe depuis `seed`.
 * playerA / playerB = { id, sheet: {force, vigueur, mobilite, intelligence, charisme} }
 * Retourne { winner_id, turns: [{turn_index, stat, attacker_id, defender_id, attacker_roll, defender_roll, damage, hp_a_after, hp_b_after}], total_turns }
 */
export function simulateFight(seed, playerA, playerB) {
  const rng = createRng(seed)
  const maxHpA = computeMaxHp(playerA.sheet)
  const maxHpB = computeMaxHp(playerB.sheet)
  let hpA = maxHpA
  let hpB = maxHpB

  const turns = []
  let turnIdx = 0
  const MAX_TURNS = 200 // safety

  while (hpA > 0 && hpB > 0 && turnIdx < MAX_TURNS) {
    // Stat aléatoire (déterministe) pour ce tour
    const stat = STATS[randInt(rng, 0, STATS.length - 1)]
    // Attacker = A aux tours pairs, B aux impairs
    const attackerIsA = turnIdx % 2 === 0
    const attacker = attackerIsA ? playerA : playerB
    const defender = attackerIsA ? playerB : playerA
    const attackerStat = Number(attacker.sheet?.[stat] || 0)
    const defenderStat = Number(defender.sheet?.[stat] || 0)

    const attackerRoll = rollForStat(rng, attackerStat)
    const defenderRoll = rollForStat(rng, defenderStat)

    let damage = 0
    if (defenderRoll < attackerRoll) {
      damage = attackerRoll - defenderRoll
      if (attackerIsA) hpB = Math.max(0, hpB - damage)
      else hpA = Math.max(0, hpA - damage)
    }

    turns.push({
      turn_index: turnIdx,
      stat,
      attacker_id: attacker.id,
      defender_id: defender.id,
      attacker_roll: attackerRoll,
      defender_roll: defenderRoll,
      damage,
      hp_a_after: hpA,
      hp_b_after: hpB,
    })
    turnIdx++
  }

  const winner_id = hpA > hpB ? playerA.id : playerB.id
  return { winner_id, turns, total_turns: turns.length, max_hp_a: maxHpA, max_hp_b: maxHpB }
}

/**
 * Génère la liste des matchups round 1 d'un bracket single-elim.
 * Mélange déterministe des player_ids via le seed.
 */
export function generateBracket(seed, playerIds) {
  const n = playerIds.length // doit être puissance de 2
  const rng = createRng(hashSeed('bracket', seed))
  // Fisher-Yates shuffle
  const arr = [...playerIds]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  const rounds = []
  // Round 1 : paires
  const r1 = []
  for (let i = 0; i < n; i += 2) {
    r1.push({ round: 1, bracket_position: i / 2, player_a_id: arr[i], player_b_id: arr[i + 1] })
  }
  rounds.push(r1)
  // Rounds suivants : placeholders (players seront calculés depuis winners des tours précédents)
  let prev = r1
  let round = 2
  while (prev.length > 1) {
    const next = []
    for (let i = 0; i < prev.length; i += 2) {
      next.push({ round, bracket_position: i / 2, player_a_id: null, player_b_id: null })
    }
    rounds.push(next)
    prev = next
    round++
  }
  return rounds.flat() // [{round, bracket_position, player_a_id, player_b_id}, ...]
}

/**
 * Résout tous les combats d'un bracket déterministiquement.
 * Retourne la liste complète avec winner_id et joueurs remplis pour tous les rounds.
 */
export function resolveBracket(tournamentSeed, bracketFights, playerSheets) {
  // Map: { playerId: sheet }
  const fights = bracketFights.map(f => ({ ...f }))
  // Group by round
  const byRound = {}
  for (const f of fights) {
    if (!byRound[f.round]) byRound[f.round] = []
    byRound[f.round].push(f)
  }
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b)
  for (const r of rounds) {
    const rFights = byRound[r].sort((a, b) => a.bracket_position - b.bracket_position)
    for (const f of rFights) {
      // Fill players from previous round winners if needed
      if (!f.player_a_id || !f.player_b_id) {
        const prev = byRound[r - 1].sort((a, b) => a.bracket_position - b.bracket_position)
        const pos = f.bracket_position
        f.player_a_id = prev[pos * 2].winner_id
        f.player_b_id = prev[pos * 2 + 1].winner_id
      }
      const seed = hashSeed('fight', tournamentSeed, r, f.bracket_position)
      const pA = { id: f.player_a_id, sheet: playerSheets[f.player_a_id] || {} }
      const pB = { id: f.player_b_id, sheet: playerSheets[f.player_b_id] || {} }
      const sim = simulateFight(seed, pA, pB)
      f.winner_id = sim.winner_id
      f.simulation = sim
    }
  }
  return fights
}
