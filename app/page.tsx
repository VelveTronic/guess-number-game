import { normalizeCode } from '@/lib/code'
import { Game } from '@/components/game'

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const params = await searchParams
  const initialRoom = normalizeCode(params.room ?? '') ?? ''
  return <Game initialRoom={initialRoom} />
}
