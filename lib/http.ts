import { NextResponse } from 'next/server'
import type { Err } from './types'

const STATUS: Record<Err, number> = {
  not_found: 404,
  expired: 410,
  full: 409,
  forbidden: 403,
  length: 400,
  turn: 409,
  format: 400,
  state: 409,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function playerId(req: Request) {
  const id = req.headers.get('x-player-id')?.trim() ?? ''
  return UUID.test(id) ? id : null
}

export function fail(error: Err) {
  return NextResponse.json({ error }, { status: STATUS[error], headers: { 'cache-control': 'no-store' } })
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

export async function readJson(req: Request) {
  try {
    const data: unknown = await req.json()
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    return data as Record<string, unknown>
  } catch {
    return {}
  }
}

export function denied() {
  return fail('forbidden')
}

export function serverError() {
  return NextResponse.json({ error: 'state' }, { status: 500, headers: { 'cache-control': 'no-store' } })
}
