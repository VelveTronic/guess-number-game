'use client'

import { inkOf } from './bricks'

export type Mark = 'out' | 'pin'

export function NoteGrid({
  length,
  marks,
  onCycle,
}: {
  length: number
  marks: Record<string, Mark>
  onCycle: (pos: number, digit: string) => void
}) {
  return (
    <div className="note-grid" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
      {Array.from({ length }, (_, pos) => (
        <div className="note-col" key={pos}>
          {Array.from({ length: 10 }, (_, digit) => {
            const label = String(digit)
            const state = marks[`${pos}:${label}`]
            const pinned = state === 'pin'
            return (
              <button
                key={label}
                type="button"
                data-pos={pos}
                data-digit={label}
                className={`brick tiny ${pinned ? `d${label} ${inkOf(label)}` : 'hollow'} ${state === 'out' ? 'out' : ''}`}
                onClick={() => onCycle(pos, label)}
              >
                {label}
                {state === 'out' ? <i className="strike" /> : null}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
