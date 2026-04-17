import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(resolve(process.cwd(), 'scripts/007-product-group-suggestions.sql'), 'utf8')

describe('CAT-05 schema migration', () => {
  it('creates persisted suggestions with decision metadata', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS product_group_suggestions')
    expect(migration).toContain('confidence DECIMAL(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1)')
    expect(migration).toContain('reasons JSONB NOT NULL')
    expect(migration).toContain("status VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded'))")
    expect(migration).toContain('signals_snapshot JSONB NOT NULL')
    expect(migration).toContain('decision_at TIMESTAMP')
    expect(migration).toContain("change_origin VARCHAR(24) NOT NULL CHECK (change_origin IN ('heuristic', 'recompute', 'accept', 'reject'))")
  })

  it('enforces one pending suggestion per source product and user isolation', () => {
    expect(migration).toContain('WHERE status = \'pending\'')
    expect(migration).toContain('ALTER TABLE product_group_suggestions ENABLE ROW LEVEL SECURITY;')
    expect(migration).toContain('CREATE POLICY product_group_suggestions_user_isolation ON product_group_suggestions')
  })
})
