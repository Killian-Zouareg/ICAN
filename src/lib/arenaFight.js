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

// Roll for a stat: 1 à (20 + stat * 4 + bonus)
function rollForStat(rng, statValue, bonus = 0) {
  const max = 20 + Math.max(0, Math.min(5, Number(statValue || 0))) * 4 + Math.max(0, bonus || 0)
  return randInt(rng, 1, max)
}

/**
 * simulateFight — déterministe depuis `seed`.
 * playerA / playerB = { id, sheet: {force, vigueur, mobilite, intelligence, charisme} }
 * rollBonusA / rollBonusB = bonus ajouté au max des jets de ce combattant (attaque ET défense).
 *   Ex: chaque supporter donne +N au max, ce qui améliore statistiquement ses jets.
 * Retourne { winner_id, turns: [...], total_turns, max_hp_a, max_hp_b }
 */
export function simulateFight(seed, playerA, playerB, rollBonusA = 0, rollBonusB = 0) {
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

    const attackerBonus = attackerIsA ? rollBonusA : rollBonusB
    const defenderBonus = attackerIsA ? rollBonusB : rollBonusA
    const attackerRoll = rollForStat(rng, attackerStat, attackerBonus)
    const defenderRoll = rollForStat(rng, defenderStat, defenderBonus)

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

function nextPowerOfTwo(n) {
  let p = 1
  while (p < n) p *= 2
  return p
}

/**
 * Détermine le nombre de rondes suisses pour N joueurs.
 * Pour les petits tournois : N-1 rondes (tout le monde se bat contre tout le monde),
 * plafonné à 5 rondes pour rester jouable.
 */
export function swissRoundsFor(n) {
  if (n < 2) return 0
  return Math.max(1, Math.min(n - 1, 5))
}

/**
 * Tournoi en rondes suisses, déterministe depuis `seed`.
 *
 * - À chaque ronde, les joueurs sont classés par victoires (tiebreak : ordre shuffled initial).
 * - On apparie adjacemment en évitant les rematchs quand possible.
 * - Si N impair : le joueur le plus bas au classement qui n'a pas encore reçu de bye l'obtient (compte comme victoire).
 *
 * Retourne { fights, standings, winner_id, num_rounds }.
 */
export function resolveSwiss(seed, playerIds, playerSheets = {}, rollBonuses = {}, numRounds = null) {
  const n = playerIds.length
  if (n < 2) return { fights: [], standings: [], winner_id: null, num_rounds: 0 }

  const rounds = numRounds || swissRoundsFor(n)
  const rng = createRng(hashSeed('swiss-shuffle', seed))

  // Ordre initial shuffled déterministe
  const initialOrder = [...playerIds]
  for (let i = initialOrder.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i)
    ;[initialOrder[i], initialOrder[j]] = [initialOrder[j], initialOrder[i]]
  }
  const initialIndex = {}
  initialOrder.forEach((pid, idx) => { initialIndex[pid] = idx })

  const wins = {}, losses = {}, byes = {}
  const opponents = {}
  for (const pid of playerIds) {
    wins[pid] = 0; losses[pid] = 0; byes[pid] = 0
    opponents[pid] = new Set()
  }

  const allFights = []

  for (let r = 1; r <= rounds; r++) {
    // Classement actuel : victoires desc, puis ordre initial
    const sorted = [...playerIds].sort((a, b) => {
      if (wins[b] !== wins[a]) return wins[b] - wins[a]
      return initialIndex[a] - initialIndex[b]
    })

    const remaining = [...sorted]
    const pairs = []

    // Bye si impair : joueur le plus bas qui n'a pas eu de bye
    if (remaining.length % 2 === 1) {
      let byeIdx = -1
      for (let i = remaining.length - 1; i >= 0; i--) {
        if (!byes[remaining[i]]) { byeIdx = i; break }
      }
      if (byeIdx < 0) byeIdx = remaining.length - 1 // tout le monde a déjà eu un bye
      const byePlayer = remaining.splice(byeIdx, 1)[0]
      pairs.push([byePlayer, null, true])
    }

    // Pairings adjacents, évitant les rematchs
    while (remaining.length >= 2) {
      const p1 = remaining.shift()
      let idx = remaining.findIndex(p => !opponents[p1].has(p))
      if (idx < 0) idx = 0
      const p2 = remaining.splice(idx, 1)[0]
      pairs.push([p1, p2, false])
    }

    // Simulate chaque fight
    for (let fi = 0; fi < pairs.length; fi++) {
      const [a, b, isBye] = pairs[fi]
      if (isBye) {
        byes[a]++
        wins[a]++
        allFights.push({
          round: r,
          bracket_position: fi,
          player_a_id: a,
          player_b_id: null,
          is_bye: true,
          winner_id: a,
          simulation: null,
        })
      } else {
        const fightSeed = hashSeed('fight', seed, r, fi)
        const pA = { id: a, sheet: playerSheets[a] || {} }
        const pB = { id: b, sheet: playerSheets[b] || {} }
        const bonusA = rollBonuses[a] || 0
        const bonusB = rollBonuses[b] || 0
        const sim = simulateFight(fightSeed, pA, pB, bonusA, bonusB)
        if (sim.winner_id === a) { wins[a]++; losses[b]++ }
        else { wins[b]++; losses[a]++ }
        opponents[a].add(b); opponents[b].add(a)
        allFights.push({
          round: r,
          bracket_position: fi,
          player_a_id: a,
          player_b_id: b,
          is_bye: false,
          winner_id: sim.winner_id,
          simulation: sim,
        })
      }
    }
  }

  // Standings finaux
  const finalStandings = [...playerIds].sort((a, b) => {
    if (wins[b] !== wins[a]) return wins[b] - wins[a]
    return initialIndex[a] - initialIndex[b]
  }).map(pid => ({
    profile_id: pid,
    wins: wins[pid],
    losses: losses[pid],
    byes: byes[pid],
  }))

  return {
    fights: allFights,
    standings: finalStandings,
    winner_id: finalStandings[0]?.profile_id || null,
    num_rounds: rounds,
  }
}

/**
 * Re-calcule le classement à partir d'une liste de fights (ex. persistés en DB).
 * Retourne { standings, winner_id }.
 */
export function computeStandings(playerIds, fights) {
  const wins = {}, losses = {}, byes = {}
  for (const pid of playerIds) { wins[pid] = 0; losses[pid] = 0; byes[pid] = 0 }
  // Ordre initial stable : par ordre d'apparition dans fights de R1
  const initialIndex = {}
  playerIds.forEach((pid, i) => { initialIndex[pid] = i })
  for (const f of fights) {
    if (f.is_bye) {
      if (f.winner_id) { wins[f.winner_id] = (wins[f.winner_id] || 0) + 1; byes[f.winner_id] = (byes[f.winner_id] || 0) + 1 }
    } else if (f.winner_id) {
      wins[f.winner_id] = (wins[f.winner_id] || 0) + 1
      const loser = f.winner_id === f.player_a_id ? f.player_b_id : f.player_a_id
      if (loser) losses[loser] = (losses[loser] || 0) + 1
    }
  }
  const standings = [...playerIds].sort((a, b) => {
    if (wins[b] !== wins[a]) return wins[b] - wins[a]
    return (initialIndex[a] || 0) - (initialIndex[b] || 0)
  }).map(pid => ({ profile_id: pid, wins: wins[pid] || 0, losses: losses[pid] || 0, byes: byes[pid] || 0 }))
  return { standings, winner_id: standings[0]?.profile_id || null }
}

/**
 * Génère un bracket single-elim avec gestion des byes (exemptions de round 1)
 * quand le nombre de joueurs n'est pas une puissance de 2.
 *
 * Ex. 5 joueurs → bracketSize = 8, 3 byes. 3 joueurs exemptés passent directement au round 2,
 * et seulement 1 combat R1 oppose les 2 derniers (2 "vrais" joueurs sur 5 → 1 match R1, 4 matchs restants répartis).
 * Plus précisément : byes occupent des slots null en R1, les matchs avec un null sont des byes (l'autre avance).
 * Les fights bye sont marqués `is_bye=true` et résolus immédiatement.
 */
export function generateBracket(seed, playerIds) {
  const n = playerIds.length
  const bracketSize = nextPowerOfTwo(Math.max(2, n))
  const numByes = bracketSize - n
  const rng = createRng(hashSeed('bracket', seed))

  // Shuffle déterministe des joueurs
  const arr = [...playerIds]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  // Les `numByes` premiers joueurs (dans l'ordre shuffled) reçoivent un bye (opposant = null)
  // Construire les slots R1 : pour chaque bye, on met [joueur, null], puis on remplit les paires normales
  const slots = []
  let playerIdx = 0
  for (let i = 0; i < numByes; i++) {
    slots.push(arr[playerIdx++])
    slots.push(null)
  }
  while (playerIdx < arr.length) {
    slots.push(arr[playerIdx++])
  }
  // À ce stade, slots.length === bracketSize

  const rounds = []
  const r1 = []
  for (let i = 0; i < bracketSize; i += 2) {
    const a = slots[i]
    const b = slots[i + 1]
    const isBye = a === null || b === null
    r1.push({
      round: 1,
      bracket_position: i / 2,
      player_a_id: a,
      player_b_id: b,
      is_bye: isBye,
    })
  }
  rounds.push(r1)
  let prev = r1
  let round = 2
  while (prev.length > 1) {
    const next = []
    for (let i = 0; i < prev.length; i += 2) {
      next.push({ round, bracket_position: i / 2, player_a_id: null, player_b_id: null, is_bye: false })
    }
    rounds.push(next)
    prev = next
    round++
  }
  return rounds.flat()
}

/**
 * Résout tous les combats d'un bracket déterministiquement.
 * Retourne la liste complète avec winner_id et joueurs remplis pour tous les rounds.
 */
export function resolveBracket(tournamentSeed, bracketFights, playerSheets, rollBonuses = {}) {
  // rollBonuses = { [playerId]: bonus ajouté au max des jets }
  const fights = bracketFights.map(f => ({ ...f }))
  const byRound = {}
  for (const f of fights) {
    if (!byRound[f.round]) byRound[f.round] = []
    byRound[f.round].push(f)
  }
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b)
  for (const r of rounds) {
    const rFights = byRound[r].sort((a, b) => a.bracket_position - b.bracket_position)
    for (const f of rFights) {
      // Round > 1 : remplir les joueurs depuis les winners du round précédent
      if (r > 1 && (!f.player_a_id || !f.player_b_id)) {
        const prev = byRound[r - 1].sort((a, b) => a.bracket_position - b.bracket_position)
        const pos = f.bracket_position
        f.player_a_id = prev[pos * 2].winner_id
        f.player_b_id = prev[pos * 2 + 1].winner_id
      }
      // Bye (round 1) : l'un des deux est null, l'autre gagne automatiquement
      if (r === 1 && (f.player_a_id === null || f.player_b_id === null)) {
        f.winner_id = f.player_a_id || f.player_b_id
        f.is_bye = true
        f.simulation = null
        continue
      }
      const seed = hashSeed('fight', tournamentSeed, r, f.bracket_position)
      const pA = { id: f.player_a_id, sheet: playerSheets[f.player_a_id] || {} }
      const pB = { id: f.player_b_id, sheet: playerSheets[f.player_b_id] || {} }
      const bonusA = rollBonuses[f.player_a_id] || 0
      const bonusB = rollBonuses[f.player_b_id] || 0
      const sim = simulateFight(seed, pA, pB, bonusA, bonusB)
      f.winner_id = sim.winner_id
      f.simulation = sim
    }
  }
  return fights
}
