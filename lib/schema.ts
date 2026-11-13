import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function schemaStatements() {
  return readFileSync(join(process.cwd(), 'schema.sql'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}
