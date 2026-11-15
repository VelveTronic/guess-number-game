'use client'

import { useEffect, useState } from 'react'

type Box = { top: number; left: number; width: number; height: number }

export function Spotlight({
  spot,
  dim,
  onDim,
  onHole,
}: {
  spot: string
  dim: boolean
  onDim: () => void
  onHole?: () => void
}) {
  const [box, setBox] = useState<Box | null>(null)

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
    </div>
  )
}
