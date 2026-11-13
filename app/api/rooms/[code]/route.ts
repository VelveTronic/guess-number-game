import { normalizeCode } from '@/lib/code'
import { getStore } from '@/lib/db'
import { denied, fail, ok, playerId, serverError } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ code: string }> }

export async function GET(req: Request, ctx: Ctx) {
  const id = playerId(req)
  if (!id) return denied()
  const code = normalizeCode((await ctx.params).code)
  if (!code) return fail('not_found')
  try {
    const room = await getStore().get(code, id)
    if (!room.ok) return fail(room.error)
    return ok(room.view)
  } catch {
    return serverError()
  }
}
