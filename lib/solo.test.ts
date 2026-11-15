import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CPU_PAUSE_MS, createSolo } from './solo'

const opts = {
  level: 'easy' as const,
  digitLength: 3 as const,
  turnSeconds: 30 as const,
  rng: () => 0,
  now: 1_000,
}

describe('solo', () => {
  it('hides the computer secret until the round is over', () => {
    const solo = createSolo(opts)
    const locked = solo.lock('111', 1_000)
    assert.equal(locked.ok, true)
    if (!locked.ok) return
    assert.equal(locked.view.oppSecret, null)
    assert.equal(locked.view.oppLocked, true)
    assert.equal(locked.view.youLocked, true)
    assert.equal(locked.view.yourSecret, '111')
    assert.equal(locked.view.status, 'playing')
    assert.equal(locked.view.turn, '1')
  })

  it('wins when the guess matches the computer secret', () => {
    const solo = createSolo(opts)
    assert.equal(solo.lock('111', 1_000).ok, true)
    const won = solo.guess('000', 1_100)
    assert.equal(won.ok, true)
    if (!won.ok) return
    assert.equal(won.view.status, 'done')
    assert.equal(won.view.winner, 'you')
    assert.equal(won.view.oppSecret, '000')
  })

  it('loses when the computer matches the locked secret', () => {
    const solo = createSolo(opts)
    assert.equal(solo.lock('012', 1_000).ok, true)
    const guessed = solo.guess('111', 1_010)
    assert.equal(guessed.ok, true)
    if (!guessed.ok) return
    assert.equal(guessed.view.status, 'playing')
    assert.equal(guessed.view.turn, '2')
    assert.equal(guessed.view.oppGuess, null)
    const early = solo.tick(1_010 + CPU_PAUSE_MS - 1)
    assert.equal(early.oppGuess, null)
    assert.equal(early.winner, null)
    const lost = solo.tick(1_010 + CPU_PAUSE_MS)
    assert.equal(lost.oppGuess?.guess, '012')
    assert.equal(lost.status, 'done')
    assert.equal(lost.winner, 'opp')
    assert.equal(lost.oppSecret, '000')
  })

  it('passes a timed-out turn to the computer, then back', () => {
    const solo = createSolo(opts)
    assert.equal(solo.lock('111', 1_000).ok, true)
    const passed = solo.tick(1_000 + 30_000)
    assert.equal(passed.turn, '2')
    assert.equal(passed.oppGuess, null)
    const played = solo.tick(1_000 + 30_000 + CPU_PAUSE_MS)
    assert.equal(played.oppGuess?.guess, '012')
    assert.equal(played.turn, '1')
    assert.equal(played.status, 'playing')
  })

  it('locks a new hidden secret on rematch', () => {
    const solo = createSolo(opts)
    assert.equal(solo.lock('111', 1_000).ok, true)
    assert.equal(solo.guess('000', 1_100).ok, true)
    const again = solo.rematch(2_000)
    assert.equal(again.ok, true)
    if (!again.ok) return
    assert.equal(again.view.status, 'locking')
    assert.equal(again.view.oppLocked, true)
    assert.equal(again.view.youLocked, false)
    assert.equal(again.view.oppSecret, null)
    assert.equal(again.view.winner, null)
    assert.equal(again.view.guesses.length, 0)
  })
})
