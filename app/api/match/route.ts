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
    const result = await getStore().match(id, digitLength)
    if (!result.ok) return fail(result.error)
    if (result.queued) return ok({ queued: true })
    return ok({ queued: false, code: result.code, seat: result.seat })
  } catch {
    return serverError()
  }
}

export async function DELETE(req: Request) {
  const id = playerId(req)
  if (!id) return denied()
  try {
    const result = await getStore().leaveQueue(id)
    return ok(result.ok ? result : { left: true })
  } catch {
    return serverError()
  }
}
