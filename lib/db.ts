import { sharedMemory, type Store } from './memory'
import { createNeonStore } from './neon'

let neonStore: Store | null = null

export function getStore(): Store {
  const url = process.env.DATABASE_URL
  if (url) {
    if (!neonStore) neonStore = createNeonStore(url)
    return neonStore
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production')
  }
  return sharedMemory()
}
