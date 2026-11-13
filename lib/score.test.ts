import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hits } from './score'

describe('hits', () => {
  it('counts digits that sit in the same place', () => {
    assert.equal(hits('7541', '4444'), 1)
    assert.equal(hits('7541', '2222'), 0)
    assert.equal(hits('7541', '7451'), 2)
    assert.equal(hits('7541', '7541'), 4)
  })
})
