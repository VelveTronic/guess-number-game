import { getStore } from '@/lib/db'
import { denied, fail, ok, playerId, readJson, serverError } from '@/lib/http'
import { parseLength, parseSeconds } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const id = playerId(req)
  if (!id) return denied()
  const body = await readJson(req)
  const digitLength = parseLength(body.digitLength)
  const turnSeconds = body.turnSeconds == null ? 45 : parseSeconds(body.turnSeconds)
  if (!digitLength) return fail('length')
  if (!turnSeconds) return fail('format')
  try {
    const created = await getStore().createRoom(id, digitLength, turnSeconds)
    if (!created.ok) return fail(created.error)
    return ok({ code: created.code, seat: created.seat })
  } catch {
    return serverError()
  }
}
