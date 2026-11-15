import { outcomeWord, type Outcome } from '@/lib/outcome'

const CONFETTI = [
  { left: '8%', color: '#00f0f0', delay: '0ms', duration: '1400ms' },
  { left: '18%', color: '#f0f000', delay: '80ms', duration: '1600ms' },
  { left: '30%', color: '#f00000', delay: '40ms', duration: '1500ms' },
  { left: '42%', color: '#00f000', delay: '140ms', duration: '1700ms' },
  { left: '54%', color: '#0000f0', delay: '20ms', duration: '1450ms' },
  { left: '66%', color: '#f0a000', delay: '160ms', duration: '1550ms' },
  { left: '76%', color: '#a000f0', delay: '60ms', duration: '1650ms' },
  { left: '86%', color: '#f070a0', delay: '120ms', duration: '1480ms' },
  { left: '24%', color: '#c8c8c8', delay: '180ms', duration: '1580ms' },
  { left: '60%', color: '#008080', delay: '100ms', duration: '1680ms' },
]

export function Verdict({ outcome }: { outcome: Outcome }) {
  return (
    <div className={`verdict verdict-${outcome}`} role="status" aria-live="assertive">
      <p className="verdict-word">{outcomeWord(outcome)}</p>
      {outcome === 'win' ? (
        <div className="confetti" aria-hidden="true">
          {CONFETTI.map((piece) => (
            <span
              key={`${piece.left}-${piece.delay}`}
              style={{
                left: piece.left,
                background: piece.color,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
