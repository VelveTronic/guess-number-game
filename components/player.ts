const KEY = 'guess-player'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function getPlayerId() {
  const existing = localStorage.getItem(KEY)
  if (existing && UUID.test(existing)) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(KEY, id)
  return id
}
