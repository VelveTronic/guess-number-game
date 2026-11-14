'use client'

import { useEffect, useRef, useState } from 'react'
import { CODE_ROWS, normalizeCode } from '@/lib/code'
import { outcomeOf } from '@/lib/outcome'
import type { DigitLength, TurnSeconds, View } from '@/lib/types'
import { ApiError, api } from './api'
import { Brick, BrickButton } from './bricks'
import { BackIcon, ClockIcon, ShareIcon } from './icons'
import { NoteGrid, type Mark } from './notes'
import { Numpad } from './numpad'
import { getPlayerId } from './player'
import { Verdict } from './verdict'

const WORDS: Record<string, string> = {
  not_found: '没有',
  expired: '过期',
  full: '满了',
  forbidden: '没有',
  length: '短了',
  turn: '等',
  format: '短了',
  state: '等',
  offline: '断',
}

const LENGTHS: DigitLength[] = [3, 4, 5, 6]
const TIMES: TurnSeconds[] = [30, 45, 60, 90]
const LENGTH_TONE = ['', '', '', 'd0 dark', 'd3 dark', 'd4 dark', 'd5 light']

type Phase = { name: 'home' } | { name: 'join'; code: string } | { name: 'queue' } | { name: 'room'; code: string }
type Mode = 'play' | 'notes'
type Screen = 'boot' | 'home' | 'join' | 'queue' | 'wait' | 'done' | 'live'

function screenOf(boot: boolean, phase: Phase['name'], status: View['status'] | undefined): Screen {
  if (boot) return 'boot'
  if (phase === 'home') return 'home'
  if (phase === 'join') return 'join'
  if (phase === 'queue') return 'queue'
  if (status === 'waiting') return 'wait'
  if (status === 'done') return 'done'
  return 'live'
}

function wordOf(error: unknown) {
  if (!(error instanceof ApiError) || error.status >= 500 || error.status === 0) return '断'
  return WORDS[error.code] ?? '断'
}

let audio: AudioContext | null = null

function blip(freq: number) {
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.value = 0.03
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + 0.04)
  } catch {
    /* this phone stayed quiet */
  }
}

export function Game({ initialRoom }: { initialRoom: string }) {
  const [phase, setPhase] = useState<Phase>({ name: 'home' })
  const [boot, setBoot] = useState(Boolean(initialRoom))
  const [length, setLength] = useState<DigitLength>(4)
  const [seconds, setSeconds] = useState<TurnSeconds>(45)
  const [view, setView] = useState<View | null>(null)
  const [entry, setEntry] = useState('')
  const [mode, setMode] = useState<Mode>('play')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  const [offline, setOffline] = useState(false)
  const [copied, setCopied] = useState(false)
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [notesFor, setNotesFor] = useState('')
  const [fresh, setFresh] = useState(false)
  const seenGuesses = useRef(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevStatus = useRef<View['status'] | null>(null)
  const queueCancel = useRef(false)
  const submittedCode = useRef('')
  const flashTimer = useRef(0)
  const onKey = useRef<(event: KeyboardEvent) => void>(() => {})

  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  const roomCode = phase.name === 'room' ? phase.code : ''

  function show(word: string) {
    setFlash(word)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(''), 900)
  }

  function take(next: View) {
    setView((current) => (!current || current.code !== next.code || next.rev >= current.rev ? next : current))
    setOffline(false)
  }

  async function enter(code: string) {
    history.replaceState(null, '', `/?room=${code}`)
    try {
      take(await api<View>(`/api/rooms/${code}`))
      setPhase({ name: 'room', code })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'forbidden') {
        try {
          take(await api<View>('/api/rooms/join', { method: 'POST', body: JSON.stringify({ code }) }))
          setPhase({ name: 'room', code })
          return
        } catch (joinError) {
          show(wordOf(joinError))
          setPhase({ name: 'join', code })
          return
        }
      }
      show(wordOf(error))
    }
  }

  useEffect(() => {
    if (!initialRoom) return
    let stop = false
    void (async () => {
      try {
        const next = await api<View>(`/api/rooms/${initialRoom}`)
        if (stop) return
        take(next)
        setPhase({ name: 'room', code: initialRoom })
      } catch (error) {
        if (stop) return
        if (error instanceof ApiError && error.code === 'forbidden') {
          try {
            const joined = await api<View>('/api/rooms/join', { method: 'POST', body: JSON.stringify({ code: initialRoom }) })
            if (stop) return
            take(joined)
            setPhase({ name: 'room', code: initialRoom })
            return
          } catch (joinError) {
            if (stop) return
            show(wordOf(joinError))
            setPhase({ name: 'join', code: initialRoom })
            return
          }
        }
        show(wordOf(error))
      } finally {
        if (!stop) setBoot(false)
      }
    })()
    return () => {
      stop = true
    }
    // The room link is only read once, when the cabinet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom])

  useEffect(() => {
    if (!roomCode) return
    let stop = false
    let timer = 0
    const tick = async () => {
      try {
        const next = await api<View>(`/api/rooms/${roomCode}`)
        if (stop) return
        take(next)
        const hurry = next.leftMs != null && next.leftMs < 2000
        if (!stop) timer = window.setTimeout(tick, document.hidden ? 4000 : hurry ? 400 : 1200)
        return
      } catch (error) {
        if (stop) return
        if (error instanceof ApiError && (error.code === 'expired' || error.code === 'not_found' || error.code === 'forbidden')) {
          show(wordOf(error))
          setView(null)
          setPhase({ name: 'home' })
          history.replaceState(null, '', '/')
          return
        }
        setOffline(true)
      }
      if (!stop) timer = window.setTimeout(tick, document.hidden ? 4000 : 1200)
    }
    timer = window.setTimeout(tick, 1200)
    return () => {
      stop = true
      window.clearTimeout(timer)
    }
  }, [roomCode])

  useEffect(() => {
    if (phase.name !== 'queue') return
    queueCancel.current = false
    let stop = false
    let timer = 0
    const tick = async () => {
      try {
        const result = await api<{ queued: boolean; code?: string }>('/api/match', {
          method: 'POST',
          body: JSON.stringify({ digitLength: length }),
        })
        if (stop || queueCancel.current) return
        if (!result.queued && result.code) {
          await enter(result.code)
          return
        }
      } catch (error) {
        if (!stop) show(wordOf(error))
      }
      if (!stop) timer = window.setTimeout(tick, document.hidden ? 4000 : 1200)
    }
    void tick()
    return () => {
      stop = true
      window.clearTimeout(timer)
    }
  }, [phase.name, length])

  useEffect(() => {
    const count = view?.guesses.length ?? 0
    if (seenGuesses.current === -1) {
      seenGuesses.current = count
      return
    }
    if (count > seenGuesses.current) setFresh(true)
    seenGuesses.current = count
  }, [view?.guesses.length, view?.code])

  useEffect(() => {
    if (view?.code !== roomCode) seenGuesses.current = -1
  }, [roomCode, view?.code])

  useEffect(() => {
    if (!roomCode) return
    const key = `guess-notes:${roomCode}:${getPlayerId()}`
    const raw = localStorage.getItem(key)
    if (!raw) {
      setMarks({})
      setNotesFor(roomCode)
      return
    }
    try {
      const parsed: unknown = JSON.parse(raw)
      setMarks(parsed && typeof parsed === 'object' ? (parsed as Record<string, Mark>) : {})
    } catch {
      setMarks({})
    }
    setNotesFor(roomCode)
  }, [roomCode])

  useEffect(() => {
    if (!roomCode || notesFor !== roomCode) return
    localStorage.setItem(`guess-notes:${roomCode}:${getPlayerId()}`, JSON.stringify(marks))
  }, [marks, notesFor, roomCode])

  useEffect(() => {
    const status = view?.status ?? null
    if (prevStatus.current && prevStatus.current !== 'done' && status === 'done') setMode('play')
    if (prevStatus.current === 'done' && status === 'locking' && roomCode) {
      localStorage.removeItem(`guess-notes:${roomCode}:${getPlayerId()}`)
      setMarks({})
      setEntry('')
      setMode('play')
    }
    prevStatus.current = status
  }, [view?.status, roomCode])

  const padOn = Boolean(
    view &&
      !busy &&
      ((view.status === 'locking' && !view.youLocked) || (view.status === 'playing' && view.turn === view.seat)),
  )
  const size = view?.digitLength ?? length
  const canDrop = padOn && entry.length === size

  function pushDigit(digit: string) {
    if (!padOn || entry.length >= size) return
    setEntry((current) => (current.length >= size ? current : current + digit))
  }

  function backspace() {
    if (!padOn) return
    setEntry((current) => current.slice(0, -1))
  }

  async function commit() {
    if (!canDrop || !view || phase.name !== 'room') return
    const payload = entry
    setBusy(true)
    try {
      const path = view.status === 'locking' ? 'secret' : 'guess'
      const body = view.status === 'locking' ? { secret: payload } : { guess: payload }
      const next = await api<View>(`/api/rooms/${phase.code}/${path}`, { method: 'POST', body: JSON.stringify(body) })
      take(next)
      setEntry('')
      blip(next.status === 'done' ? 660 : 440)
    } catch (error) {
      show(wordOf(error))
      blip(110)
    } finally {
      setBusy(false)
    }
  }

  onKey.current = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (phase.name === 'join') {
      if (event.key === 'Backspace') {
        event.preventDefault()
        setPhase((current) => (current.name === 'join' ? { name: 'join', code: current.code.slice(0, -1) } : current))
      }
      const ch = event.key.toUpperCase()
      if (ch.length === 1 && CODE_ROWS.join('').includes(ch)) {
        event.preventDefault()
        typeCode(ch)
      }
      return
    }
    if (!padOn) return
    if (event.key >= '0' && event.key <= '9') {
      event.preventDefault()
      pushDigit(event.key)
    } else if (event.key === 'Backspace') {
      event.preventDefault()
      backspace()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void commit()
    }
  }

  useEffect(() => {
    const listen = (event: KeyboardEvent) => onKey.current(event)
    window.addEventListener('keydown', listen)
    return () => window.removeEventListener('keydown', listen)
  }, [])

  function home() {
    queueCancel.current = true
    if (phase.name === 'queue') void api('/api/match', { method: 'DELETE' }).catch(() => undefined)
    setPhase({ name: 'home' })
    setView(null)
    setEntry('')
    setMode('play')
    history.replaceState(null, '', '/')
  }

  async function createRoom() {
    if (busy) return
    setBusy(true)
    try {
      const created = await api<{ code: string }>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ digitLength: length, turnSeconds: seconds }),
      })
      await enter(created.code)
    } catch (error) {
      show(wordOf(error))
    } finally {
      setBusy(false)
    }
  }

  function typeCode(ch: string) {
    setPhase((current) => {
      if (current.name !== 'join') return current
      return { name: 'join', code: (current.code + ch).slice(0, 4) }
    })
  }

  useEffect(() => {
    if (phase.name !== 'join') return
    if (phase.code.length < 4) {
      submittedCode.current = ''
      return
    }
    if (submittedCode.current === phase.code) return
    submittedCode.current = phase.code
    const normal = normalizeCode(phase.code)
    if (normal) void enter(normal)
    else show('没有')
  }, [phase])

  async function share(code: string) {
    const url = `${location.origin}/?room=${code}`
    try {
      if (navigator.share) {
        await navigator.share({ url })
        return
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 400)
    } catch {
      show('断')
    }
  }

  async function again() {
    if (phase.name !== 'room' || busy) return
    setBusy(true)
    try {
      take(await api<View>(`/api/rooms/${phase.code}/rematch`, { method: 'POST' }))
      setEntry('')
      setMode('play')
    } catch (error) {
      show(wordOf(error))
    } finally {
      setBusy(false)
    }
  }

  function cycle(pos: number, digit: string) {
    const key = `${pos}:${digit}`
    setMarks((current) => {
      const next = { ...current }
      const state = next[key]
      if (!state) next[key] = 'out'
      else if (state === 'out') next[key] = 'pin'
      else delete next[key]
      return next
    })
  }

  useEffect(() => {
    if (view?.status === 'playing' && view.turn !== view.seat) setEntry('')
  }, [view?.status, view?.turn, view?.seat])

  const screen = screenOf(boot, phase.name, view?.status)
  const outcome = screen === 'done' && view ? outcomeOf(view.status, view.winner) : null

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [view?.guesses.length, view?.code, screen])
  const showLever = screen === 'live' || screen === 'done'
  const showHold = Boolean(view && view.status !== 'waiting' && screen !== 'boot' && screen !== 'home' && screen !== 'join' && screen !== 'queue')

  return (
    <main
      className={`cabinet is-${screen} ${mode === 'notes' ? 'is-notes' : 'is-play'} ${offline ? 'is-offline' : ''} ${outcome ? `is-${outcome}` : ''}`}
      data-screen={screen}
      data-outcome={outcome ?? 'none'}
    >
      <header className="top">
        {screen === 'home' || screen === 'boot' ? (
          <h1 className="marquee">
            <span className="d0">猜</span>
            <span className="d3">数</span>
            <span className="d5">字</span>
          </h1>
        ) : (
          <div className="lamps">
            <Lamp seat="1" view={view} queue={screen === 'queue'} yours={screen === 'queue' || view?.seat === '1'} />
            {showLever ? (
              <div className="lever">
                <BrickButton className="lever-btn" hollow={mode !== 'play'} aria-pressed={mode === 'play'} onClick={() => setMode('play')}>
                  猜
                </BrickButton>
                <BrickButton className="lever-btn" hollow={mode !== 'notes'} aria-pressed={mode === 'notes'} onClick={() => setMode('notes')}>
                  记
                </BrickButton>
              </div>
            ) : (
              <span />
            )}
            <Lamp seat="2" view={view} queue={false} yours={view?.seat === '2'} />
          </div>
        )}
      </header>

      <div className="stage">
        {showHold && view ? (
          <div className="hold">
            <span className="stamp">HOLD</span>
            {Array.from({ length: view.digitLength }, (_, index) => {
              const digit = view.yourSecret?.[index]
              return digit ? <Brick key={index} digit={digit} /> : <span key={index} className="brick hollow" />
            })}
          </div>
        ) : null}

        <section className="well" aria-busy={boot || busy}>
          {outcome ? <Verdict outcome={outcome} /> : null}
          <div key={`${screen}-${mode}`} className="well-face">
          {flash ? (
            <p className="flash" role="alert">
              {flash}
            </p>
          ) : null}
          {offline && !flash ? <p className="flash">断</p> : null}
          {screen === 'home' ? (
            <div className="home-pick">
            <div className="lengths">
              {LENGTHS.map((item) => (
                <BrickButton
                  key={item}
                  hollow={item !== length}
                  className={item === length ? LENGTH_TONE[item] : ''}
                  aria-pressed={item === length}
                  onClick={() => setLength(item)}
                >
                  {item}
                </BrickButton>
              ))}
            </div>
            <div className="times">
              <ClockIcon />
              <div className="time-row">
              {TIMES.map((item) => (
                <BrickButton
                  key={item}
                  hollow={item !== seconds}
                  className={item === seconds ? 'd2 dark' : ''}
                  aria-pressed={item === seconds}
                  onClick={() => setSeconds(item)}
                >
                  {item}
                </BrickButton>
              ))}
              </div>
            </div>
            </div>
          ) : null}
          {screen === 'wait' && view ? (
            <div className="waiting">
              <div className={`code-row ${copied ? 'copied' : ''}`}>
                {view.code.split('').map((ch, index) => (
                  <span key={index} className="brick d3 dark">
                    {ch}
                  </span>
                ))}
              </div>
              <div className="length-pips">
                {Array.from({ length: view.digitLength }, (_, index) => (
                  <span key={index} className="brick d0 dark pip" />
                ))}
              </div>
            </div>
          ) : null}
          {screen === 'queue' ? (
            <div className="length-pips">
              {Array.from({ length }, (_, index) => (
                <span key={index} className={`brick d3 dark pip ${index === 0 ? 'pulse' : ''}`} />
              ))}
            </div>
          ) : null}
          {screen === 'join' ? (
            <div className={`code-row ${flash ? 'shake' : ''}`}>
              {Array.from({ length: 4 }, (_, index) => {
                const ch = phase.name === 'join' ? phase.code[index] : ''
                return (
                  <span key={index} className={ch ? 'brick d3 dark' : 'brick hollow'}>
                    {ch}
                  </span>
                )
              })}
            </div>
          ) : null}
          {view && (screen === 'live' || screen === 'done') ? (
            <>
              <OppLine view={view} />
              <Target view={view} />
              <div className="well-scroll" ref={scrollRef}>
                <div className="scroll-pad" />
                <History className="history-main" tagged guesses={view.guesses} fresh={fresh} />
                {(view.status === 'locking' && !view.youLocked) || (view.status === 'playing' && view.turn === view.seat) ? (
                  <LiveRow value={entry} length={view.digitLength} />
                ) : null}
              </div>
            </>
          ) : null}
          </div>
        </section>

        <aside className="side">
          {view ? <History className="history-side" guesses={view.guesses} fresh={fresh} /> : null}
          {view ? <NoteGrid length={view.digitLength} marks={marks} onCycle={cycle} /> : null}
        </aside>
      </div>

      <div className="dock">
        <div key={`${screen}-${mode}`} className="dock-face">
        {screen === 'home' ? (
          <div className="actions">
            <BrickButton className="d0 dark action" disabled={busy} onClick={() => void createRoom()}>
              开房
            </BrickButton>
            <BrickButton className="d3 dark action" onClick={() => setPhase({ name: 'join', code: '' })}>
              加入
            </BrickButton>
            <BrickButton
              className="d4 dark action"
              onClick={() => {
                queueCancel.current = false
                setPhase({ name: 'queue' })
              }}
            >
              匹配
            </BrickButton>
          </div>
        ) : null}
        {screen === 'join' ? (
          <div className="code-pad">
            {CODE_ROWS.map((row) => (
              <div className="code-line" key={row}>
                {row.split('').map((ch) => (
                  <BrickButton key={ch} className="key" onClick={() => typeCode(ch)}>
                    {ch}
                  </BrickButton>
                ))}
              </div>
            ))}
            <div className="dock-row">
              <BrickButton
                hollow
                aria-label="拆"
                onClick={() => setPhase((current) => (current.name === 'join' ? { name: 'join', code: current.code.slice(0, -1) } : current))}
              >
                <BackIcon />
              </BrickButton>
              <BrickButton hollow onClick={home}>
                撤
              </BrickButton>
            </div>
          </div>
        ) : null}
        {screen === 'wait' && view ? (
          <div className="dock-row">
            <BrickButton className="d0 dark" aria-label="分享" onClick={() => void share(view.code)}>
              <ShareIcon />
            </BrickButton>
            <BrickButton hollow onClick={home}>
              撤
            </BrickButton>
          </div>
        ) : null}
        {screen === 'queue' ? (
          <BrickButton hollow className="action" onClick={home}>
            撤
          </BrickButton>
        ) : null}
        {screen === 'live' && view ? (
          <Numpad disabled={!padOn} canDrop={canDrop} onDigit={pushDigit} onBack={backspace} onDrop={() => void commit()} />
        ) : null}
        {screen === 'done' ? (
          <BrickButton className="d4 dark action" disabled={busy} onClick={() => void again()}>
            再来
          </BrickButton>
        ) : null}
        </div>
      </div>
    </main>
  )
}

function Lamp({
  seat,
  view,
  queue,
  yours,
}: {
  seat: '1' | '2'
  view: View | null
  queue: boolean
  yours: boolean
}) {
  const occupied = queue ? seat === '1' : Boolean(view && (seat === '1' || view.status !== 'waiting'))
  const turn = Boolean(view && view.status === 'playing' && view.turn === seat)
  const won = Boolean(
    view &&
      view.status === 'done' &&
      ((view.winner === 'you' && view.seat === seat) || (view.winner === 'opp' && view.seat !== seat)),
  )
  const cls = occupied ? `here ${yours ? 'mine' : ''} ${turn || won || (queue && seat === '1') ? 'on' : ''}` : 'hollow'
  return (
    <span className={`brick lamp p${seat} ${cls}`} aria-current={yours ? 'true' : undefined}>
      {seat === '1' ? '1P' : '2P'}
    </span>
  )
}

function Clock({ leftMs }: { leftMs: number | null }) {
  const [left, setLeft] = useState(leftMs ?? 0)
  useEffect(() => {
    if (leftMs == null) return
    setLeft(leftMs)
    const start = performance.now()
    const id = window.setInterval(() => setLeft(Math.max(0, leftMs - (performance.now() - start))), 200)
    return () => window.clearInterval(id)
  }, [leftMs])
  if (leftMs == null) return null
  const secs = Math.max(0, Math.ceil(left / 1000))
  return <span className={`brick clock ${secs <= 10 ? 'd5 light' : ''}`}>{secs}</span>
}

function OppLine({ view }: { view: View }) {
  const opp = view.seat === '1' ? '2' : '1'
  const guess = view.oppGuess
  const solved = Boolean(guess && view.status === 'done' && guess.hits === view.digitLength)
  return (
    <div className="opp-line">
      <span className={`brick seat-pip p${opp} here`}>{opp === '1' ? '1P' : '2P'}</span>
      <div className={`row with-hit ${solved ? 'solved' : ''}`} style={{ ['--n' as string]: view.digitLength }}>
        {Array.from({ length: view.digitLength }, (_, index) =>
          guess ? <Brick key={index} digit={guess.guess[index]} /> : <span key={index} className="brick hollow" />,
        )}
        <span className="brick hit" data-opp-hits={guess ? guess.hits : undefined}>
          {guess ? guess.hits : ''}
        </span>
      </div>
      {view.status === 'playing' ? <Clock leftMs={view.leftMs} /> : null}
    </div>
  )
}

function Target({ view }: { view: View }) {
  const open = view.status === 'done' ? view.oppSecret : null
  return (
    <div className={`row target ${open ? 'reveal' : ''}`} style={{ ['--n' as string]: view.digitLength }} data-open={open ?? ''}>
      {Array.from({ length: view.digitLength }, (_, index) =>
        open ? (
          <Brick key={index} digit={open[index]} />
        ) : (
          <span key={index} className={view.oppLocked || view.status === 'playing' || view.status === 'done' ? 'brick down' : 'brick hollow'} />
        ),
      )}
    </div>
  )
}

function LiveRow({ value, length }: { value: string; length: number }) {
  return (
    <div className="row live" style={{ ['--n' as string]: length }}>
      {Array.from({ length }, (_, index) => {
        const digit = value[index]
        return digit ? <Brick key={index} digit={digit} /> : <span key={index} className="brick hollow" />
      })}
    </div>
  )
}

function History({
  guesses,
  fresh,
  tagged = false,
  className = '',
}: {
  guesses: View['guesses']
  fresh: boolean
  tagged?: boolean
  className?: string
}) {
  return (
    <div className={`history ${className}`.trim()}>
      {guesses.map((row, index) => (
        <div
          key={`${row.guess}-${index}`}
          className={`row with-hit ${fresh && index === guesses.length - 1 ? 'drop' : ''} ${row.hits === row.guess.length ? 'win' : ''}`}
          style={{ ['--n' as string]: row.guess.length }}
        >
          {row.guess.split('').map((digit, place) => (
            <Brick key={place} digit={digit} />
          ))}
          <span className="brick hit" data-hits={tagged ? row.hits : undefined}>
            {row.hits}
          </span>
        </div>
      ))}
    </div>
  )
}
