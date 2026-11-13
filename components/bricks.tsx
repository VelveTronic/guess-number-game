import type { ButtonHTMLAttributes } from 'react'

const LIGHT = new Set(['1', '5', '6', '8'])

export function inkOf(digit: string) {
  return LIGHT.has(digit) ? 'light' : 'dark'
}

export function Brick({
  digit,
  hollow = false,
  down = false,
  className = '',
}: {
  digit?: string
  hollow?: boolean
  down?: boolean
  className?: string
}) {
  const tone = digit ? `d${digit} ${inkOf(digit)}` : ''
  const face = hollow ? 'hollow' : down ? 'down' : tone
  return <span className={`brick ${face} ${className}`.trim()}>{down ? '' : digit}</span>
}

export function BrickButton({
  digit,
  hollow = false,
  className = '',
  ...props
}: {
  digit?: string
  hollow?: boolean
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const tone = !hollow && digit ? `d${digit} ${inkOf(digit)}` : ''
  return (
    <button type="button" className={`brick brick-btn ${hollow ? 'hollow' : tone} ${className}`.trim()} {...props}>
      {props.children ?? digit}
    </button>
  )
}
