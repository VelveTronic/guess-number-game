import type { Status } from './types'

export type Outcome = 'win' | 'lose'

const WORDS = {
  win: '赢了',
  lose: '输了',
} as const

export function outcomeOf(status: Status, winner: 'you' | 'opp' | null): Outcome | null {
  if (status !== 'done' || winner == null) return null
  return winner === 'you' ? 'win' : 'lose'
}

export function outcomeWord(outcome: Outcome) {
  return WORDS[outcome]
}
