import { hits } from './score'
import type { DigitLength } from './types'

export type Level = 'easy' | 'mid' | 'hard'
export type Seen = { guess: string; hits: number }
export type Rng = () => number

const FULL = 10_000
const SAMPLE = 80
const POOL = 120

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

export function codeOf(n: number, length: number) {
  return n.toString().padStart(length, '0').slice(-length)
}

export function fits(code: string, seen: Seen[]) {
  return seen.every((row) => hits(code, row.guess) === row.hits)
}

export function randomCode(length: number, rng: Rng, avoid?: Set<string>) {
  const span = 10 ** length
  for (let i = 0; i < 32; i++) {
    const code = codeOf(Math.floor(rng() * span), length)
    if (!avoid?.has(code)) return code
  }
  for (let n = 0; n < span; n++) {
    const code = codeOf(n, length)
    if (!avoid?.has(code)) return code
  }
  return codeOf(0, length)
}

function easyCode(length: number, rng: Rng, used: Set<string>) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const bag = DIGITS.slice()
    let code = ''
    for (let i = 0; i < length; i++) {
      const at = Math.floor(rng() * bag.length)
      code += bag.splice(at, 1)[0]
    }
    if (!used.has(code)) return code
  }
  return randomCode(length, rng, used)
}

function sample(length: number, rng: Rng, seen: Seen[], limit: number, used?: Set<string>) {
  const span = 10 ** length
  const out: string[] = []
  if (span <= FULL) {
    for (let n = 0; n < span && out.length < limit; n++) {
      const code = codeOf(n, length)
      if (used?.has(code)) continue
      if (fits(code, seen)) out.push(code)
    }
    return out
  }
  const draws = Math.min(span, limit * 40)
  for (let i = 0; i < draws && out.length < limit; i++) {
    const code = codeOf(Math.floor(rng() * span), length)
    if (used?.has(code) || out.includes(code) || !fits(code, seen)) continue
    out.push(code)
  }
  if (out.length) return out
  const start = Math.floor(rng() * span)
  for (let i = 0; i < span && out.length < limit; i++) {
    const code = codeOf((start + i) % span, length)
    if (used?.has(code) || !fits(code, seen)) continue
    out.push(code)
  }
  return out
}

function entropy(length: number, rng: Rng, seen: Seen[], used: Set<string>) {
  const span = 10 ** length
  const secrets = sample(length, rng, seen, span <= FULL ? FULL : POOL)
  if (secrets.length <= 1) return secrets[0] ?? randomCode(length, rng, used)
  const candidates =
    secrets.length <= 300 && span <= FULL
      ? secrets.filter((code) => !used.has(code))
      : sample(length, rng, seen, SAMPLE, used)
  if (!candidates.length) return randomCode(length, rng, used)
  let best = candidates[0]
  let bestScore = -1
  for (const guess of candidates) {
    const buckets = new Map<number, number>()
    for (const secret of secrets) {
      const count = hits(secret, guess)
      buckets.set(count, (buckets.get(count) ?? 0) + 1)
    }
    let score = 0
    for (const count of buckets.values()) {
      const p = count / secrets.length
      score -= p * Math.log2(p)
    }
    if (score > bestScore) {
      bestScore = score
      best = guess
    }
  }
  return best
}

export function cpuGuess(level: Level, length: DigitLength, seen: Seen[], rng: Rng = Math.random) {
  const used = new Set(seen.map((row) => row.guess))
  if (level === 'easy') return easyCode(length, rng, used)
  if (seen.length === 0) {
    // An empty history is the whole 10^n set. Open on 0123… instead of scoring it.
    return level === 'hard' ? '0123456789'.slice(0, length) : randomCode(length, rng, used)
  }
  if (level === 'mid') return sample(length, rng, seen, 1, used)[0] ?? randomCode(length, rng, used)
  return entropy(length, rng, seen, used)
}
