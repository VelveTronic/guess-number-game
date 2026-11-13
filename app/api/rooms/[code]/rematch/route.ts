import { normalizeCode } from '@/lib/code'
import { getStore } from '@/lib/db'
import { denied, fail, ok, playerId, serverError } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ code: string }> }

export async function POST(req: Request, ctx: Ctx) {
  const id = playerId(req)
  if (!id) return denied()
  const code = normalizeCode((await ctx.params).code)
  if (!code) return fail('not_found')
  try {
    const next = await getStore().rematch(code, id)
    if (!next.ok) return fail(next.error)
    return ok(next.view)
  } catch {
    return serverError()
  }
}
