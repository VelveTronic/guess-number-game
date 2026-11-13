import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMemoryStore } from './memory'
import { ROOM_TTL_MS } from './rules'

describe('memory rooms', () => {
  it('scores 4444 against 7541 as 1 and hides the secret until the end', async () => {
    const store = createMemoryStore()
    const created = await store.createRoom('p1', 4)
    assert.equal(created.ok, true)
    if (!created.ok) return
    const joined = await store.join(created.code, 'p2')
    assert.equal(joined.ok, true)

    const lock1 = await store.lock(created.code, 'p1', '1234')
    assert.equal(lock1.ok, true)
    if (!lock1.ok) return
    assert.equal(lock1.view.yourSecret, '1234')
    assert.equal(lock1.view.oppSecret, null)

    const lock2 = await store.lock(created.code, 'p2', '7541')
    assert.equal(lock2.ok, true)
    if (!lock2.ok) return
    assert.equal(lock2.view.status, 'playing')
    assert.equal(lock2.view.turn, '1')

    const early = await store.guess(created.code, 'p2', '0000')
    assert.equal(early.ok, false)
    if (early.ok) return
    assert.equal(early.error, 'turn')

    const probe = await store.guess(created.code, 'p1', '4444')
    assert.equal(probe.ok, true)
    if (!probe.ok) return
    assert.deepEqual(probe.view.guesses, [{ guess: '4444', hits: 1 }])
    assert.equal(probe.view.oppSecret, null)
    assert.equal(probe.view.oppGuess, null)
    assert.equal(JSON.stringify(probe.view).includes('7541'), false)

    const other = await store.get(created.code, 'p2')
    assert.equal(other.ok, true)
    if (!other.ok) return
    assert.equal(JSON.stringify(other.view).includes('1234'), false)
    assert.equal(other.view.yourSecret, '7541')
    assert.deepEqual(other.view.oppGuess, { guess: '4444', hits: 1 })
    assert.equal(other.view.guesses.length, 0)

    const miss = await store.guess(created.code, 'p2', '0000')
    assert.equal(miss.ok, true)
    if (!miss.ok) return
    assert.equal(miss.view.guesses[0]?.hits, 0)

    const win = await store.guess(created.code, 'p1', '7541')
    assert.equal(win.ok, true)
    if (!win.ok) return
    assert.equal(win.view.winner, 'you')
    assert.equal(win.view.oppSecret, '7541')

    const revealed = await store.get(created.code, 'p2')
    assert.equal(revealed.ok, true)
    if (!revealed.ok) return
    assert.equal(revealed.view.winner, 'opp')
    assert.equal(revealed.view.oppSecret, '1234')
  })

  it('rejects a third player and expires a stale room', async () => {
    let now = 1_000
    const store = createMemoryStore(() => now)
    const created = await store.createRoom('p1', 4)
    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal((await store.join(created.code, 'p2')).ok, true)
    const full = await store.join(created.code, 'p3')
    assert.equal(full.ok, false)
    if (full.ok) return
    assert.equal(full.error, 'full')

    now += ROOM_TTL_MS + 1
    const expired = await store.get(created.code, 'p1')
    assert.equal(expired.ok, false)
    if (expired.ok) return
    assert.equal(expired.error, 'expired')
  })

  it('pairs two players who ask for the same length', async () => {
    const store = createMemoryStore()
    const first = await store.match('a', 4)
    assert.equal(first.ok && first.queued, true)
    const second = await store.match('b', 4)
    assert.equal(second.ok, true)
    if (!second.ok) return
    assert.equal(second.queued, false)
    if (second.queued) return
    assert.equal(second.seat, '2')
    const waiting = await store.match('a', 4)
    assert.equal(waiting.ok, true)
    if (!waiting.ok || waiting.queued) return
    assert.equal(waiting.seat, '1')
    assert.equal(waiting.code, second.code)
    const room = await store.get(second.code, 'b')
    assert.equal(room.ok, true)
    if (!room.ok) return
    assert.equal(room.view.status, 'locking')
    assert.equal(room.view.digitLength, 4)
    assert.equal(room.view.turnSeconds, 45)
  })

  it('passes the turn when the clock runs out', async () => {
    let now = 5_000
    const store = createMemoryStore(() => now)
    const created = await store.createRoom('p1', 4, 30)
    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal((await store.join(created.code, 'p2')).ok, true)
    assert.equal((await store.lock(created.code, 'p1', '1234')).ok, true)
    const started = await store.lock(created.code, 'p2', '7541')
    assert.equal(started.ok, true)
    if (!started.ok) return
    assert.equal(started.view.turn, '1')
    assert.equal(started.view.leftMs, 30_000)

    now += 30_001
    const passed = await store.get(created.code, 'p2')
    assert.equal(passed.ok, true)
    if (!passed.ok) return
    assert.equal(passed.view.turn, '2')
    assert.equal(passed.view.seat, '2')
    const late = await store.guess(created.code, 'p1', '4444')
    assert.equal(late.ok, false)
  })
})
