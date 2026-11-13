import { normalizeCode } from '@/lib/code'
import { getStore } from '@/lib/db'
import { denied, fail, ok, playerId, readJson, serverError } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const id = playerId(req)
  if (!id) return denied()
  const body = await readJson(req)
  const code = normalizeCode(String(body.code ?? ''))
  if (!code) return fail('not_found')
  try {
    const joined = await getStore().join(code, id)
    if (!joined.ok) return fail(joined.error)
    return ok(joined.view)
  } catch {
    return serverError()
  }
}
