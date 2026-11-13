import { readFileSync } from 'node:fs'
import { Pool, neonConfig } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('缺少 DATABASE_URL')
  process.exit(1)
}

if (!neonConfig.webSocketConstructor && globalThis.WebSocket) {
  neonConfig.webSocketConstructor = globalThis.WebSocket
}

const statements = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

const pool = new Pool({ connectionString: url, max: 1 })
const client = await pool.connect()
try {
  for (const statement of statements) await client.query(statement)
  console.log('schema ok')
} finally {
  client.release()
  await pool.end()
}
