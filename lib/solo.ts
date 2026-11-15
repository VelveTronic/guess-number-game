import { cpuGuess, randomCode, type Level, type Rng } from './cpu'
import { lockSecret, present, rematchRoom, submitGuess, tickRoom } from './rules'
import type { DigitLength, GuessRow, No, Room, TurnSeconds, View } from './types'

const CPU = 'cpu'
export const CPU_PAUSE_MS = 480

let seq = 0

export type Solo = {
  code: string
  level: Level
  lock(secret: string, now: number): { ok: true; view: View } | No
  guess(guess: string, now: number): { ok: true; view: View } | No
  rematch(now: number): { ok: true; view: View } | No
  tick(now: number): View
  view(now: number): View
}

export function createSolo(opts: {
  level: Level
  digitLength: DigitLength
  turnSeconds: TurnSeconds
  playerId?: string
  rng?: Rng
  now?: number
}): Solo {
  const rng = opts.rng ?? Math.random
  const playerId = opts.playerId ?? 'you'
  const opened = opts.now ?? Date.now()
  let guesses: GuessRow[] = []
  let cpuAt = 0
  let room: Room = {
    code: `S${opened.toString(36)}${(seq++).toString(36)}`,
    digitLength: opts.digitLength,
    status: 'locking',
    p1: playerId,
    p2: CPU,
    turn: null,
    p1Secret: null,
    p2Secret: randomCode(opts.digitLength, rng),
    winner: null,
    turnSeconds: opts.turnSeconds,
    deadline: null,
    updatedAt: opened,
    createdAt: opened,
  }

  function show(now: number) {
    const presented = present(room, guesses, playerId, now)
    if (!presented.ok) {
      const stale = present(room, guesses, playerId, room.updatedAt)
      if (stale.ok) return stale.view
      throw new Error(presented.error)
    }
    return presented.view
  }

  function schedule(now: number) {
    cpuAt = room.status === 'playing' && room.turn === '2' ? now + CPU_PAUSE_MS : 0
  }

  function playCpu(now: number) {
    if (room.status !== 'playing' || room.turn !== '2' || now < cpuAt) return
    const seen = guesses.filter((row) => row.seat === '2').map((row) => ({ guess: row.guess, hits: row.hits }))
    const guess = cpuGuess(opts.level, room.digitLength, seen, rng)
    const result = submitGuess(room, CPU, guess, now)
    if (!result.ok) return
    room = result.room
    guesses = [...guesses, result.row]
    schedule(now)
  }

  return {
    code: room.code,
    level: opts.level,
    view(now: number) {
      playCpu(now)
      return show(now)
    },
    lock(secret: string, now: number) {
      const result = lockSecret(room, playerId, secret, now)
      if (!result.ok) return result
      room = result.room
      schedule(now)
      return { ok: true, view: show(now) }
    },
    guess(guess: string, now: number) {
      playCpu(now)
      const result = submitGuess(room, playerId, guess, now)
      if (!result.ok) return result
      room = result.room
      guesses = [...guesses, result.row]
      schedule(now)
      return { ok: true, view: show(now) }
    },
    rematch(now: number) {
      const result = rematchRoom(room, playerId, now)
      if (!result.ok) return result
      room = { ...result.room, p2Secret: randomCode(room.digitLength, rng), updatedAt: now }
      guesses = []
      schedule(now)
      return { ok: true, view: show(now) }
    },
    tick(now: number) {
      const next = tickRoom(room, now)
      if (next !== room) {
        room = next
        schedule(now)
      }
      playCpu(now)
      return show(now)
    },
  }
}
