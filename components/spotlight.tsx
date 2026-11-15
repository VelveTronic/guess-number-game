'use client'

import { useEffect, useRef, useState } from 'react'

type Box = { top: number; left: number; width: number; height: number }
type Cap = { top: number; left: number; width: number }

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
      const height = capRef.current?.offsetHeight ?? 72
      const width = Math.min(336, window.innerWidth - 16)
      const below = box.top + box.height + 10
      const above = box.top - height - 10
      const mid = box.top + box.height / 2
      let top = mid > window.innerHeight * 0.5 ? above : below
      if (top < 8) top = below
      if (top + height > window.innerHeight - 8) top = Math.max(8, above)
      let left = box.left + box.width / 2 - width / 2
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
      setCap({ top, left, width })
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
