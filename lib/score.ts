export function hits(secret: string, guess: string) {
  const length = Math.min(secret.length, guess.length)
  let count = 0
  for (let i = 0; i < length; i++) {
    if (secret[i] === guess[i]) count += 1
  }
  return count
}
