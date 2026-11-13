export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_ROWS = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ', '23456789'] as const

export function normalizeCode(input: string) {
  const code = input.trim().toUpperCase()
  if (code.length !== 4) return null
  for (const ch of code) {
    if (!ALPHABET.includes(ch)) return null
  }
  return code
}

export function randomCode() {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}
