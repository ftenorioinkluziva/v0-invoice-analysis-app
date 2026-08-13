import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'scripts/011-arq-01-rls-hardening.sql'),
  'utf8'
)

describe('ARQ-01 database hardening migration', () => {
  it('forces RLS on every mandatory tenant table', () => {
    const tenantTables = [
      'stores',
      'products',
      'invoices',
      'invoice_items',
      'shopping_lists',
      'shopping_list_items',
      'alerts',
      'user_preferences',
    ]

    for (const table of tenantTables) {
      expect(migration).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`)
    }
  })

  it('grants only data-plane access to the runtime role', () => {
    expect(migration).toContain('GRANT USAGE ON SCHEMA public, app TO invoice_runtime;')
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO invoice_runtime;'
    )
    expect(migration).not.toContain('BYPASSRLS')
    expect(migration).not.toContain('SUPERUSER')
  })

  it('scopes the store CNPJ uniqueness constraint by tenant', () => {
    expect(migration).toContain('ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_cnpj_key;')
    expect(migration).toContain('ON stores (user_id, cnpj)')
  })
})
