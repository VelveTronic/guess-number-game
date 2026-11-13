import { Pool, neonConfig } from '@neondatabase/serverless'
import { randomCode } from './code'
import { joinRoom, lockSecret, MATCH_SECONDS, present, rematchRoom, submitGuess, tickRoom } from './rules'
import { schemaStatements } from './schema'
import {
  parseSeconds,
  type DigitLength,
  type GuessRow,
  type No,
  type Room,
  type Seat,
  type Status,
  type View,
} from './types'
import type { Store } from './memory'

type Querier = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

function asStatus(value: unknown): Status {
  if (value === 'waiting' || value === 'locking' || value === 'playing' || value === 'done') return value
  return 'waiting'
}

function asSeat(value: unknown): Seat | null {
  if (value === '1' || value === '2') return value
  return null
}

function asLength(value: unknown): DigitLength {
  const n = Number(value)
  if (n === 3 || n === 4 || n === 5 || n === 6) return n
  return 4
}

function asTime(value: unknown) {
  if (value instanceof Date) return value.getTime()
  return new Date(String(value)).getTime()
}

function mapRoom(row: Record<string, unknown>): Room {
  return {
    code: String(row.code),
    digitLength: asLength(row.digit_length),
    status: asStatus(row.status),
    p1: String(row.p1),
    p2: row.p2 == null ? null : String(row.p2),
    turn: asSeat(row.turn),
    p1Secret: row.p1_secret == null ? null : String(row.p1_secret),
    p2Secret: row.p2_secret == null ? null : String(row.p2_secret),
    winner: asSeat(row.winner),
    turnSeconds: parseSeconds(row.turn_seconds) ?? 45,
    deadline: row.deadline == null ? null : asTime(row.deadline),
    updatedAt: asTime(row.updated_at),
    createdAt: asTime(row.created_at),
  }
}

function mapGuess(row: Record<string, unknown>): GuessRow {
  return {
    seat: asSeat(row.seat) ?? '1',
    guess: String(row.guess),
    hits: Number(row.hits),
    createdAt: asTime(row.created_at),
  }
}

export function createNeonStore(url: string): Store {
  if (!neonConfig.webSocketConstructor && globalThis.WebSocket) {
    neonConfig.webSocketConstructor = globalThis.WebSocket
  }
  const pool = new Pool({ connectionString: url, max: 1 })
  let schemaReady: Promise<void> | null = null

  function ready() {
    if (!schemaReady) {
      schemaReady = applySchema().catch((error: unknown) => {
        schemaReady = null
        throw error
      })
    }
    return schemaReady
  }

  async function applySchema() {
    const client = await pool.connect()
    try {
      for (const statement of schemaStatements()) {
        await client.query(statement)
      }
    } finally {
      client.release()
    }
  }

  async function tx<T>(fn: (q: Querier) => Promise<T>) {
    await ready()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* the connection is already unusable */
      }
      throw error
    } finally {
      client.release()
    }
  }

  async function load(q: Querier, code: string, lock: boolean) {
    const expired = await q.query(
      `DELETE FROM rooms WHERE code = $1 AND updated_at < NOW() - INTERVAL '6 hours' RETURNING code`,
      [code],
    )
    if (expired.rows.length) return { ok: false as const, error: 'expired' as const }
    const found = await q.query(`SELECT * FROM rooms WHERE code = $1${lock ? ' FOR UPDATE' : ''}`, [code])
    const row = found.rows[0]
    if (!row) return { ok: false as const, error: 'not_found' as const }
    const listed = await q.query(
      `SELECT seat, guess, hits, created_at FROM guesses WHERE room_code = $1 ORDER BY id`,
      [code],
    )
    return { ok: true as const, room: mapRoom(row), guesses: listed.rows.map(mapGuess) }
  }

  async function saveRoom(q: Querier, room: Room) {
    await q.query(
      `UPDATE rooms SET
        digit_length = $2,
        status = $3,
        p1 = $4,
        p2 = $5,
        turn = $6,
        p1_secret = $7,
        p2_secret = $8,
        winner = $9,
        turn_seconds = $10,
        deadline = $11,
        updated_at = $12
      WHERE code = $1`,
      [
        room.code,
        room.digitLength,
        room.status,
        room.p1,
        room.p2,
        room.turn,
        room.p1Secret,
        room.p2Secret,
        room.winner,
        room.turnSeconds,
        room.deadline == null ? null : new Date(room.deadline),
        new Date(room.updatedAt),
      ],
    )
  }

  function shown(room: Room, guesses: GuessRow[], playerId: string, now: number): { ok: true; view: View } | No {
    return present(room, guesses, playerId, now)
  }

  async function insertRoom(q: Querier, room: Room) {
    await q.query(
      `INSERT INTO rooms
        (code, digit_length, status, p1, p2, turn, p1_secret, p2_secret, winner, turn_seconds, deadline, updated_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        room.code,
        room.digitLength,
        room.status,
        room.p1,
        room.p2,
        room.turn,
        room.p1Secret,
        room.p2Secret,
        room.winner,
        room.turnSeconds,
        room.deadline == null ? null : new Date(room.deadline),
        new Date(room.updatedAt),
        new Date(room.createdAt),
      ],
    )
  }

  async function freshCode(q: Querier) {
    for (let i = 0; i < 8; i++) {
      const code = randomCode()
      const found = await q.query(`SELECT 1 FROM rooms WHERE code = $1`, [code])
      if (!found.rows.length) return code
    }
    throw new Error('code')
  }

  return {
    async createRoom(playerId, digitLength, turnSeconds = 45) {
      return tx(async (q) => {
        const seconds = parseSeconds(turnSeconds)
        if (!seconds) return { ok: false as const, error: 'format' as const }
        const at = Date.now()
        await q.query(`DELETE FROM queue WHERE player_id = $1 AND room_code IS NULL`, [playerId])
        const code = await freshCode(q)
        await insertRoom(q, {
          code,
          digitLength,
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
        })
        return { ok: true, code, seat: '1' as const }
      })
    },

    async join(code, playerId) {
      return tx(async (q) => {
        const opened = await load(q, code, true)
        if (!opened.ok) return opened
        const joined = joinRoom(opened.room, playerId, Date.now())
        if (!joined.ok) return joined
        await saveRoom(q, joined.room)
        return shown(joined.room, opened.guesses, playerId, Date.now())
      })
    },

    async get(code, playerId) {
      return tx(async (q) => {
        const opened = await load(q, code, true)
        if (!opened.ok) return opened
        const now = Date.now()
        const ticked = tickRoom(opened.room, now)
        if (ticked !== opened.room) await saveRoom(q, ticked)
        return shown(ticked, opened.guesses, playerId, now)
      })
    },

    async lock(code, playerId, secret) {
      return tx(async (q) => {
        const opened = await load(q, code, true)
        if (!opened.ok) return opened
        const locked = lockSecret(opened.room, playerId, secret, Date.now())
        if (!locked.ok) return locked
        await saveRoom(q, locked.room)
        return shown(locked.room, opened.guesses, playerId, Date.now())
      })
    },

    async guess(code, playerId, guess) {
      return tx(async (q) => {
        const opened = await load(q, code, true)
        if (!opened.ok) return opened
        const now = Date.now()
        const room = tickRoom(opened.room, now)
        if (room !== opened.room) await saveRoom(q, room)
        const played = submitGuess(room, playerId, guess, now)
        if (!played.ok) return played
        await saveRoom(q, played.room)
        await q.query(`INSERT INTO guesses (room_code, seat, guess, hits, created_at) VALUES ($1,$2,$3,$4,$5)`, [
          code,
          played.row.seat,
          played.row.guess,
          played.row.hits,
          new Date(played.row.createdAt),
        ])
        return shown(played.room, [...opened.guesses, played.row], playerId, now)
      })
    },

    async rematch(code, playerId) {
      return tx(async (q) => {
        const opened = await load(q, code, true)
        if (!opened.ok) return opened
        const next = rematchRoom(opened.room, playerId, Date.now())
        if (!next.ok) return next
        await saveRoom(q, next.room)
        await q.query(`DELETE FROM guesses WHERE room_code = $1`, [code])
        return shown(next.room, [], playerId, Date.now())
      })
    },

    async match(playerId, digitLength) {
      return tx(async (q) => {
        await q.query(`SELECT pg_advisory_xact_lock($1)`, [digitLength])
        await q.query(`DELETE FROM queue WHERE room_code IS NULL AND heartbeat < NOW() - INTERVAL '30 seconds'`)
        const pending = await q.query(
          `SELECT room_code, seat FROM queue WHERE player_id = $1 AND room_code IS NOT NULL FOR UPDATE`,
          [playerId],
        )
        const waiting = pending.rows[0]
        if (waiting?.room_code && (waiting.seat === '1' || waiting.seat === '2')) {
          await q.query(`DELETE FROM queue WHERE player_id = $1`, [playerId])
          return { ok: true as const, queued: false as const, code: String(waiting.room_code), seat: waiting.seat }
        }
        const other = await q.query(
          `SELECT player_id FROM queue
           WHERE digit_length = $1 AND player_id <> $2 AND room_code IS NULL
             AND heartbeat > NOW() - INTERVAL '8 seconds'
           ORDER BY heartbeat
           FOR UPDATE SKIP LOCKED
           LIMIT 1`,
          [digitLength, playerId],
        )
        const partner = other.rows[0]?.player_id
        if (partner) {
          const at = Date.now()
          const code = await freshCode(q)
          await insertRoom(q, {
            code,
            digitLength,
            status: 'locking',
            p1: String(partner),
            p2: playerId,
            turn: null,
            p1Secret: null,
            p2Secret: null,
            winner: null,
            turnSeconds: MATCH_SECONDS,
            deadline: null,
            updatedAt: at,
            createdAt: at,
          })
          await q.query(`UPDATE queue SET room_code = $1, seat = '1', heartbeat = NOW() WHERE player_id = $2`, [
            code,
            partner,
          ])
          await q.query(`DELETE FROM queue WHERE player_id = $1`, [playerId])
          return { ok: true as const, queued: false as const, code, seat: '2' as const }
        }
        await q.query(
          `INSERT INTO queue (player_id, digit_length, heartbeat, room_code, seat)
           VALUES ($1, $2, NOW(), NULL, NULL)
           ON CONFLICT (player_id) DO UPDATE
           SET digit_length = $2, heartbeat = NOW(), room_code = NULL, seat = NULL`,
          [playerId, digitLength],
        )
        return { ok: true as const, queued: true as const }
      })
    },

    async leaveQueue(playerId) {
      return tx(async (q) => {
        const pending = await q.query(
          `DELETE FROM queue WHERE player_id = $1 AND room_code IS NOT NULL RETURNING room_code, seat`,
          [playerId],
        )
        const waiting = pending.rows[0]
        if (waiting?.room_code && (waiting.seat === '1' || waiting.seat === '2')) {
          return { ok: true as const, queued: false as const, code: String(waiting.room_code), seat: waiting.seat }
        }
        await q.query(`DELETE FROM queue WHERE player_id = $1 AND room_code IS NULL`, [playerId])
        return { ok: true as const, left: true as const }
      })
    },
  }
}
