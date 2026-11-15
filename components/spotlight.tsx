'use client'

import { useEffect, useRef, useState } from 'react'

type Box = { top: number; left: number; width: number; height: number }
type Cap = { top: number; left: number; width: number }

const DIGIT_CELLS = '.row.live, .hold, .history .row, .opp-line .row, .row.target, .lengths, .time-row'

export function Spotlight({
  spot,
  dim,
  caption,
  onDim,
  onHole,
}: {
  spot: string
  dim: boolean
  caption: string
  onDim: () => void
  onHole?: () => void
}) {
  const capRef = useRef<HTMLParagraphElement>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [cap, setCap] = useState<Cap | null>(null)

  useEffect(() => {
    const read = () => {
      const nodes = document.querySelectorAll<HTMLElement>(`[data-spot="${spot}"]`)
      for (const node of nodes) {
        const rect = node.getBoundingClientRect()
        if (rect.width < 1 || rect.height < 1) continue
        const pad = 6
        setBox({
          top: Math.max(0, rect.top - pad),
          left: Math.max(0, rect.left - pad),
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        })
        return
      }
      setBox(null)
    }
    read()
    const id = window.setInterval(read, 160)
    window.addEventListener('resize', read)
    window.addEventListener('scroll', read, true)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', read)
      window.removeEventListener('scroll', read, true)
    }
  }, [spot])

  useEffect(() => {
    if (!box) return
    const place = () => {
      const node = capRef.current
      if (!node) return
      const well = document.querySelector('.well')?.getBoundingClientRect()
      const host = well && well.width > 120 ? well : { left: 8, width: window.innerWidth - 16 }
      const width = Math.min(336, Math.max(160, host.width - 16))
      node.style.width = `${width}px`
      const height = node.offsetHeight || 72
      const left = Math.max(8, Math.min(host.left + (host.width - width) / 2, window.innerWidth - width - 8))
      const gap = 8
      const blocks = [...document.querySelectorAll<HTMLElement>(DIGIT_CELLS)]
        .map((cell) => cell.getBoundingClientRect())
        .filter((rect) => rect.width > 1 && rect.height > 1)
        .map((rect) => ({
          left: rect.left - gap,
          right: rect.right + gap,
          top: rect.top - gap,
          bottom: rect.bottom + gap,
        }))
      blocks.push({
        left: box.left - gap,
        right: box.left + box.width + gap,
        top: box.top - gap,
        bottom: box.top + box.height + gap,
      })
      let best: Cap | null = null
      let bestDist = Number.POSITIVE_INFINITY
      for (let top = 8; top + height <= window.innerHeight - 8; top += 4) {
        const rect = { left, right: left + width, top, bottom: top + height }
        const blocked = blocks.some(
          (block) => rect.left < block.right && rect.right > block.left && rect.top < block.bottom && rect.bottom > block.top,
        )
        if (blocked) continue
        const dist = rect.bottom <= box.top ? box.top - rect.bottom : rect.top >= box.top + box.height ? rect.top - (box.top + box.height) : 0
        if (dist < bestDist) {
          bestDist = dist
          best = { top, left, width }
        }
      }
      if (best) setCap(best)
    }
    place()
  }, [box, caption])

  if (!box) return null
  return (
    <div className="spot">
      {dim ? (
        <>
          <div className="spot-dim" style={{ top: 0, left: 0, right: 0, height: box.top }} onClick={onDim} />
          <div className="spot-dim" style={{ top: box.top, left: 0, width: box.left, height: box.height }} onClick={onDim} />
          <div
            className="spot-dim"
            style={{ top: box.top, left: box.left + box.width, right: 0, height: box.height }}
            onClick={onDim}
          />
          <div className="spot-dim" style={{ top: box.top + box.height, left: 0, right: 0, bottom: 0 }} onClick={onDim} />
        </>
      ) : null}
      {onHole ? (
        <div className="spot-pass" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} onClick={onHole} />
      ) : null}
      <div className="spot-line" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />
      <p
        ref={capRef}
        className="spot-cap"
        role="status"
        style={cap ? { top: cap.top, left: cap.left, width: cap.width } : { top: -9999, left: 8, width: 280 }}
      >
        {caption.split('\n').map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
    </div>
  )
}
