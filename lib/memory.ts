import { randomCode } from './code'
import { isExpired, joinRoom, lockSecret, MATCH_SECONDS, present, rematchRoom, submitGuess, tickRoom } from './rules'
import {
  parseLength,
  parseSeconds,
  type DigitLength,
  type GuessRow,
  type No,
  type Room,
  type Seat,
  type TurnSeconds,
  type View,
} from './types'

type QueueEntry = {
  digitLength: DigitLength
  heartbeat: number
  code?: string
  seat?: Seat
}

export type Store = {
  createRoom(
    playerId: string,
    digitLength: DigitLength,
    turnSeconds?: TurnSeconds,
  ): Promise<{ ok: true; code: string; seat: Seat } | No>
  join(code: string, playerId: string): Promise<{ ok: true; view: View } | No>
  get(code: string, playerId: string): Promise<{ ok: true; view: View } | No>
  lock(code: string, playerId: string, secret: string): Promise<{ ok: true; view: View } | No>
  guess(code: string, playerId: string, guess: string): Promise<{ ok: true; view: View } | No>
  rematch(code: string, playerId: string): Promise<{ ok: true; view: View } | No>
  match(
    playerId: string,
    digitLength: DigitLength,
  ): Promise<{ ok: true; queued: true } | { ok: true; queued: false; code: string; seat: Seat } | No>
  leaveQueue(
    playerId: string,
  ): Promise<{ ok: true; left: true } | { ok: true; queued: false; code: string; seat: Seat }>
}

const STALE_MS = 8_000
const DROP_MS = 30_000

export function createMemoryStore(now: () => number = Date.now): Store {
  const rooms = new Map<string, Room>()
  const guesses = new Map<string, GuessRow[]>()
  const queue = new Map<string, QueueEntry>()
  let chain: Promise<unknown> = Promise.resolve()

  function serial<T>(fn: () => T): Promise<T> {
    const run = chain.then(fn, fn)
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  function freshCode() {
    for (let i = 0; i < 8; i++) {
      const code = randomCode()
      if (!rooms.has(code)) return code
    }
    throw new Error('code')
  }

  function openRoom(code: string, at: number) {
    const room = rooms.get(code)
    if (!room) return { ok: false as const, error: 'not_found' as const }
    if (isExpired(room, at)) {
      rooms.delete(code)
      guesses.delete(code)
      return { ok: false as const, error: 'expired' as const }
    }
    return { ok: true as const, room }
  }

  function viewOf(room: Room, playerId: string, at: number) {
    return present(room, guesses.get(room.code) ?? [], playerId, at)
  }

  function settle(room: Room, at: number) {
    const next = tickRoom(room, at)
    if (next !== room) rooms.set(room.code, next)
    return next
  }

  return {
    createRoom(playerId, digitLength, turnSeconds = 45) {
      return serial(() => {
        const length = parseLength(digitLength)
        const seconds = parseSeconds(turnSeconds)
        if (!length) return { ok: false, error: 'length' }
        if (!seconds) return { ok: false, error: 'format' }
        const at = now()
        const mine = queue.get(playerId)
        if (mine && !mine.code) queue.delete(playerId)
        const code = freshCode()
        const room: Room = {
          code,
          digitLength: length,
          status: 'waiting',
          p1: playerId,
          p2: null,
          turn: null,
          p1Secret: null,
          p2Secret: null,
          winner: null,
          turnSeconds: seconds,
          deadline: null,
          updatedAt: at,
          createdAt: at,
        }
        rooms.set(code, room)
        guesses.set(code, [])
        return { ok: true, code, seat: '1' }
      })
    },

    join(code, playerId) {
      return serial(() => {
        const at = now()
        const opened = openRoom(code, at)
        if (!opened.ok) return opened
        const joined = joinRoom(opened.room, playerId, at)
        if (!joined.ok) return joined
        rooms.set(code, joined.room)
        return viewOf(joined.room, playerId, at)
      })
    },

    get(code, playerId) {
      return serial(() => {
        const at = now()
        const opened = openRoom(code, at)
        if (!opened.ok) return opened
        return viewOf(settle(opened.room, at), playerId, at)
      })
    },

    lock(code, playerId, secret) {
      return serial(() => {
        const at = now()
        const opened = openRoom(code, at)
        if (!opened.ok) return opened
        const locked = lockSecret(opened.room, playerId, secret, at)
        if (!locked.ok) return locked
        rooms.set(code, locked.room)
        return viewOf(locked.room, playerId, at)
      })
    },

    guess(code, playerId, guess) {
      return serial(() => {
        const at = now()
        const opened = openRoom(code, at)
        if (!opened.ok) return opened
        const played = submitGuess(settle(opened.room, at), playerId, guess, at)
        if (!played.ok) return played
        rooms.set(code, played.room)
        guesses.set(code, [...(guesses.get(code) ?? []), played.row])
        return viewOf(played.room, playerId, at)
      })
    },

    rematch(code, playerId) {
      return serial(() => {
        const at = now()
        const opened = openRoom(code, at)
        if (!opened.ok) return opened
        const next = rematchRoom(opened.room, playerId, at)
        if (!next.ok) return next
        rooms.set(code, next.room)
        guesses.set(code, [])
        return viewOf(next.room, playerId, at)
      })
    },

    match(playerId, digitLength) {
      return serial(() => {
        const length = parseLength(digitLength)
        if (!length) return { ok: false, error: 'length' }
        const at = now()
        for (const [id, entry] of queue) {
          if (!entry.code && at - entry.heartbeat > DROP_MS) queue.delete(id)
        }
        const mine = queue.get(playerId)
        if (mine?.code && mine.seat) {
          queue.delete(playerId)
          return { ok: true, queued: false, code: mine.code, seat: mine.seat }
        }
        let oldest: { id: string; heartbeat: number } | null = null
        for (const [id, entry] of queue) {
          if (id === playerId || entry.code || entry.digitLength !== length) continue
          if (at - entry.heartbeat > STALE_MS) continue
          if (!oldest || entry.heartbeat < oldest.heartbeat) oldest = { id, heartbeat: entry.heartbeat }
        }
        if (oldest) {
          const code = freshCode()
          const room: Room = {
            code,
            digitLength: length,
            status: 'locking',
            p1: oldest.id,
            p2: playerId,
            turn: null,
            p1Secret: null,
            p2Secret: null,
            winner: null,
            turnSeconds: MATCH_SECONDS,
            deadline: null,
            updatedAt: at,
            createdAt: at,
          }
          rooms.set(code, room)
          guesses.set(code, [])
          queue.set(oldest.id, { digitLength: length, heartbeat: at, code, seat: '1' })
          queue.delete(playerId)
          return { ok: true, queued: false, code, seat: '2' }
        }
        queue.set(playerId, { digitLength: length, heartbeat: at })
        return { ok: true, queued: true }
      })
    },

    leaveQueue(playerId) {
      return serial(() => {
        const mine = queue.get(playerId)
        if (mine?.code && mine.seat) {
          queue.delete(playerId)
          return { ok: true, queued: false, code: mine.code, seat: mine.seat }
        }
        queue.delete(playerId)
        return { ok: true, left: true }
      })
    },
  }
}

const globalStore = globalThis as { __guessMemory?: Store }

export function sharedMemory() {
  if (!globalStore.__guessMemory) globalStore.__guessMemory = createMemoryStore()
  return globalStore.__guessMemory
}
