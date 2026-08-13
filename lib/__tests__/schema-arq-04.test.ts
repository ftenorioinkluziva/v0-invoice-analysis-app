import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'scripts/012-alert-idempotency.sql'),
  'utf8'
)

describe('ARQ-04 alert idempotency migration', () => {
  it('adds a tenant-scoped dedupe key and unique index', () => {
    expect(migration).toContain('ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dedupe_key TEXT;')
    expect(migration).toContain('ON alerts (user_id, dedupe_key)')
    expect(migration).toContain('WHERE dedupe_key IS NOT NULL;')
  })
})
