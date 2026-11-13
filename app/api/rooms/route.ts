import { getStore } from '@/lib/db'
import { denied, fail, ok, playerId, readJson, serverError } from '@/lib/http'
import { parseLength } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const id = playerId(req)
  if (!id) return denied()
  const body = await readJson(req)
  const digitLength = parseLength(body.digitLength)
  if (!digitLength) return fail('length')
  try {
    const created = await getStore().createRoom(id, digitLength)
    if (!created.ok) return fail(created.error)
    return ok({ code: created.code, seat: created.seat })
  } catch {
    return serverError()
  }
}
