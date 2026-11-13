import { hits } from './score'
import { isDigits, type Err, type GuessRow, type No, type Room, type Seat, type View } from './types'

export const ROOM_TTL_MS = 6 * 60 * 60 * 1000
export const MATCH_SECONDS = 45

export function tickRoom(room: Room, now: number): Room {
  if (room.status !== 'playing' || !room.turn || room.deadline == null || now < room.deadline) return room
  return {
    ...room,
    turn: room.turn === '1' ? '2' : '1',
    deadline: now + room.turnSeconds * 1000,
    updatedAt: now,
  }
}

export function isExpired(room: Room, now: number) {
  return now - room.updatedAt > ROOM_TTL_MS
}

export function seatOf(room: Room, playerId: string): Seat | null {
  if (room.p1 === playerId) return '1'
  if (room.p2 === playerId) return '2'
  return null
}

function reject(error: Err): No {
  return { ok: false, error }
}

export function joinRoom(room: Room, playerId: string, now: number): { ok: true; room: Room; seat: Seat } | No {
  if (isExpired(room, now)) return reject('expired')
  const existing = seatOf(room, playerId)
  if (existing) return { ok: true, room, seat: existing }
  if (room.status !== 'waiting' || room.p2) return reject('full')
  return {
    ok: true,
    seat: '2',
    room: { ...room, p2: playerId, status: 'locking', updatedAt: now },
  }
}

export function lockSecret(room: Room, playerId: string, secret: string, now: number): { ok: true; room: Room } | No {
  if (isExpired(room, now)) return reject('expired')
  const seat = seatOf(room, playerId)
  if (!seat) return reject('forbidden')
  if (room.status !== 'locking') return reject('state')
  if (!isDigits(secret, room.digitLength)) return reject('format')
  if (seat === '1' ? room.p1Secret : room.p2Secret) return reject('state')
  const next: Room = {
    ...room,
    updatedAt: now,
    p1Secret: seat === '1' ? secret : room.p1Secret,
    p2Secret: seat === '2' ? secret : room.p2Secret,
  }
  if (next.p1Secret && next.p2Secret) {
    next.status = 'playing'
    next.turn = '1'
    next.deadline = now + next.turnSeconds * 1000
  }
  return { ok: true, room: next }
}

export function submitGuess(
  room: Room,
  playerId: string,
  guess: string,
  now: number,
): { ok: true; room: Room; row: GuessRow } | No {
  if (isExpired(room, now)) return reject('expired')
  const seat = seatOf(room, playerId)
  if (!seat) return reject('forbidden')
  if (room.status !== 'playing' || !room.turn) return reject('state')
  if (room.turn !== seat) return reject('turn')
  if (!isDigits(guess, room.digitLength)) return reject('format')
  const secret = seat === '1' ? room.p2Secret : room.p1Secret
  if (!secret) return reject('state')
  const row: GuessRow = { seat, guess, hits: hits(secret, guess), createdAt: now }
  const won = row.hits === room.digitLength
  return {
    ok: true,
    row,
    room: {
      ...room,
      updatedAt: now,
      status: won ? 'done' : 'playing',
      turn: won ? null : seat === '1' ? '2' : '1',
      winner: won ? seat : null,
      deadline: won ? null : now + room.turnSeconds * 1000,
    },
  }
}

export function rematchRoom(room: Room, playerId: string, now: number): { ok: true; room: Room } | No {
  if (isExpired(room, now)) return reject('expired')
  if (!seatOf(room, playerId)) return reject('forbidden')
  if (room.status !== 'done') return reject('state')
  return {
    ok: true,
    room: {
      ...room,
      status: 'locking',
      p1Secret: null,
      p2Secret: null,
      turn: null,
      winner: null,
      deadline: null,
      updatedAt: now,
    },
  }
}

export function present(room: Room, guesses: GuessRow[], playerId: string, now: number): { ok: true; view: View } | No {
  if (isExpired(room, now)) return reject('expired')
  const seat = seatOf(room, playerId)
  if (!seat) return reject('forbidden')
  const yours = seat === '1' ? room.p1Secret : room.p2Secret
  const opps = seat === '1' ? room.p2Secret : room.p1Secret
  const done = room.status === 'done'
  const opp = [...guesses].reverse().find((row) => row.seat !== seat)
  return {
    ok: true,
    view: {
      code: room.code,
      digitLength: room.digitLength,
      status: room.status,
      seat,
      turn: room.turn,
      youLocked: Boolean(yours),
      oppLocked: Boolean(opps),
      yourSecret: yours,
      guesses: guesses.filter((row) => row.seat === seat).map((row) => ({ guess: row.guess, hits: row.hits })),
      oppGuess: opp ? { guess: opp.guess, hits: opp.hits } : null,
      turnSeconds: room.turnSeconds,
      leftMs: room.status === 'playing' && room.deadline != null ? Math.max(0, room.deadline - now) : null,
      winner: room.winner == null ? null : room.winner === seat ? 'you' : 'opp',
      oppSecret: done ? opps : null,
      rev: room.updatedAt,
    },
  }
}
