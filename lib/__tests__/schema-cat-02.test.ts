import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(resolve(process.cwd(), 'scripts/006-persist-comparable-product-groups.sql'), 'utf8')

describe('CAT-02 schema migration', () => {
  it('creates comparable product groups with scoped uniqueness', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS product_groups')
    expect(migration).toContain("base_unit VARCHAR(2) NOT NULL CHECK (base_unit IN ('kg', 'L'))")
    expect(migration).toContain('UNIQUE (user_id, display_name, base_unit)')
  })

  it('adds optional current group linkage to products', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS comparable_group_id INTEGER')
    expect(migration).toContain('FOREIGN KEY (comparable_group_id, user_id)')
    expect(migration).toContain('ON DELETE SET NULL')
  })

  it('adds audit trail and comparable invoice fields', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS product_group_membership_events')
    expect(migration).toContain("event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('associate', 'disassociate'))")
    expect(migration).toContain("changed_by TEXT NOT NULL CHECK (changed_by = 'system' OR changed_by = user_id)")
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS comparable_base_unit VARCHAR(2)')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS comparable_quantity_base DECIMAL(10,3)')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS comparable_unit_price DECIMAL(12,4)')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS measurement_source VARCHAR(32)')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS measurement_confidence DECIMAL(4,3)')
  })

  it('protects new comparable structures with RLS', () => {
    expect(migration).toContain('ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;')
    expect(migration).toContain('ALTER TABLE product_group_membership_events ENABLE ROW LEVEL SECURITY;')
    expect(migration).toContain('CREATE POLICY product_groups_user_isolation ON product_groups')
    expect(migration).toContain('CREATE POLICY product_group_membership_events_user_isolation ON product_group_membership_events')
  })
})
