import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cpuGuess, fits } from './cpu'
import { hits } from './score'

describe('cpu', () => {
  it('guesses a fresh code with no repeated digits on easy', () => {
    const guess = cpuGuess('easy', 4, [], () => 0)
    assert.equal(guess.length, 4)
    assert.equal(new Set(guess).size, 4)
    const again = cpuGuess('easy', 6, [{ guess, hits: 0 }], () => 0)
    assert.equal(again.length, 6)
    assert.equal(new Set(again).size, 6)
  })

  it('stays consistent with the hits it has already seen', () => {
    const seen = [{ guess: '0000', hits: 1 }]
    const mid = cpuGuess('mid', 4, seen, () => 0.5)
    const hard = cpuGuess('hard', 4, [{ guess: '0000', hits: 0 }], () => 0.2)
    assert.equal(hits(mid, '0000'), 1)
    assert.equal(fits(mid, seen), true)
    assert.equal(hits(hard, '0000'), 0)
    assert.notEqual(hard, '0000')
  })

  it('opens from a fixed code when hard has no history', () => {
    assert.equal(
      cpuGuess('hard', 6, [], () => {
        throw new Error('scan')
      }),
      '012345',
    )
    assert.equal(cpuGuess('hard', 3, [], () => 0), '012')
    assert.equal(cpuGuess('mid', 3, [], () => 0), '000')
  })
})
