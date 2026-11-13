export type Seat = '1' | '2'
export type Status = 'waiting' | 'locking' | 'playing' | 'done'
export type DigitLength = 3 | 4 | 5 | 6
export type TurnSeconds = 30 | 45 | 60 | 90
export type Err =
  | 'not_found'
  | 'expired'
  | 'full'
  | 'forbidden'
  | 'length'
  | 'turn'
  | 'format'
  | 'state'

export type Room = {
  code: string
  digitLength: DigitLength
  status: Status
  p1: string
  p2: string | null
  turn: Seat | null
  p1Secret: string | null
  p2Secret: string | null
  winner: Seat | null
  turnSeconds: TurnSeconds
  deadline: number | null
  updatedAt: number
  createdAt: number
}

export type GuessRow = {
  seat: Seat
  guess: string
  hits: number
  createdAt: number
}

export type View = {
  code: string
  digitLength: DigitLength
  status: Status
  seat: Seat
  turn: Seat | null
  youLocked: boolean
  oppLocked: boolean
  yourSecret: string | null
  guesses: { guess: string; hits: number }[]
  oppGuess: { guess: string; hits: number } | null
  turnSeconds: TurnSeconds
  leftMs: number | null
  winner: 'you' | 'opp' | null
  oppSecret: string | null
  rev: number
}

export type No = { ok: false; error: Err }

export function parseLength(value: unknown): DigitLength | null {
  const n = Number(value)
  if (n === 3 || n === 4 || n === 5 || n === 6) return n
  return null
}

export function parseSeconds(value: unknown): TurnSeconds | null {
  const n = Number(value)
  if (n === 30 || n === 45 || n === 60 || n === 90) return n
  return null
}

export function isDigits(value: unknown, length: number) {
  if (typeof value !== 'string' || value.length !== length) return false
  for (const ch of value) {
    if (ch < '0' || ch > '9') return false
  }
  return true
}
