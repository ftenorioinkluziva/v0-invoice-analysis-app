import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from '@neondatabase/serverless'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getDatabaseUrl() {
  const env = readFileSync(join(__dirname, '..', '.env'), 'utf8')
  const line = env.split(/\r?\n/).find((item) => item.startsWith('DATABASE_URL='))
  if (!line) throw new Error('DATABASE_URL não encontrado no .env')
  return line.split('=').slice(1).join('=').replace(/^'|'$/g, '')
}

const migrationFile = process.argv[2]
if (!migrationFile) {
  throw new Error('Uso: node scripts/run-migration-file.mjs <arquivo.sql>')
}

const pool = new Pool({ connectionString: getDatabaseUrl() })
const migrationPath = join(__dirname, migrationFile)
const migrationSQL = readFileSync(migrationPath, 'utf8')

await pool.query(migrationSQL)
await pool.end()
console.log(`Migração aplicada com sucesso: ${migrationFile}`)
