import { getPlayerId } from './player'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('x-player-id', getPlayerId())
  if (init?.body) headers.set('content-type', 'application/json')
  let response: Response
  try {
    response = await fetch(path, { ...init, headers, cache: 'no-store' })
  } catch {
    throw new ApiError(0, 'offline')
  }
  const data: { error?: string } = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.error || 'state')
  return data as T
}
