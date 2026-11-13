import { normalizeCode } from '@/lib/code'
import { getStore } from '@/lib/db'
import { denied, fail, ok, playerId, readJson, serverError } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ code: string }> }

export async function POST(req: Request, ctx: Ctx) {
  const id = playerId(req)
  if (!id) return denied()
  const code = normalizeCode((await ctx.params).code)
  if (!code) return fail('not_found')
  const body = await readJson(req)
  if (typeof body.secret !== 'string') return fail('format')
  try {
    const locked = await getStore().lock(code, id, body.secret)
    if (!locked.ok) return fail(locked.error)
    return ok(locked.view)
  } catch {
    return serverError()
  }
}
