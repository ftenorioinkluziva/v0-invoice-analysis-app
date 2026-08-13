import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL não definido')
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })
const migrationPath = join(__dirname, '..', 'scripts', '002-better-auth-schema.sql')
const migrationSQL = readFileSync(migrationPath, 'utf-8')

const statements = migrationSQL
  .split(';')
  .map((s) =>
    s
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim()
  )
  .filter((s) => s.length > 0)

console.log(`Aplicando ${statements.length} statements...\n`)

for (const statement of statements) {
  try {
    await pool.query(statement)
    const preview = statement.replace(/\s+/g, ' ').slice(0, 70)
    console.log(`✓ ${preview}`)
  } catch (err) {
    console.error(`✗ Erro: ${err.message}`)
    console.error(`  Statement: ${statement.slice(0, 120)}`)
    process.exit(1)
  }
}

await pool.end()

console.log('\nMigração concluída com sucesso!')
