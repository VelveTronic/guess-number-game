import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { outcomeOf, outcomeWord } from './outcome'

describe('outcome', () => {
  it('stays quiet until somebody has actually won', () => {
    assert.equal(outcomeOf('playing', null), null)
    assert.equal(outcomeOf('playing', 'you'), null)
    assert.equal(outcomeOf('done', null), null)
  })

  it('names the finished round in the cabinet words', () => {
    assert.equal(outcomeOf('done', 'you'), 'win')
    assert.equal(outcomeOf('done', 'opp'), 'lose')
    assert.equal(outcomeWord('win'), '赢了')
    assert.equal(outcomeWord('lose'), '输了')
  })
})
