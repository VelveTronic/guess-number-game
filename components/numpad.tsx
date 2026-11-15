'use client'

import { BackIcon, DropIcon } from './icons'
import { BrickButton } from './bricks'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Numpad({
  disabled,
  canDrop,
  onDigit,
  onBack,
  onDrop,
}: {
  disabled: boolean
  canDrop: boolean
  onDigit: (digit: string) => void
  onBack: () => void
  onDrop: () => void
}) {
  return (
    <div className="pad" role="group">
      {KEYS.map((digit) => (
        <BrickButton key={digit} digit={digit} hollow={disabled} disabled={disabled} onClick={() => onDigit(digit)}>
          {digit}
        </BrickButton>
      ))}
      <BrickButton hollow={disabled} disabled={disabled} onClick={onBack} aria-label="拆">
        <BackIcon />
      </BrickButton>
      <BrickButton digit="0" hollow={disabled} disabled={disabled} onClick={() => onDigit('0')}>
        0
      </BrickButton>
      <button type="button" className={`brick brick-btn drop ${canDrop ? 'lit' : 'hollow'}`} disabled={!canDrop} onClick={onDrop} aria-label="下落">
        <DropIcon />
      </button>
    </div>
  )
}
