-- Comparable catalog persistence
-- Adds user-isolated groups, membership audit, and comparable invoice fields.

CREATE TABLE IF NOT EXISTS product_groups (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    base_unit VARCHAR(2) NOT NULL CHECK (base_unit IN ('kg', 'L')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT product_groups_user_display_name_base_unit_key UNIQUE (user_id, display_name, base_unit),
    CONSTRAINT product_groups_id_user_id_key UNIQUE (id, user_id)
);

ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_id_user_id_key,
    ADD CONSTRAINT products_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS comparable_group_id INTEGER;

ALTER TABLE invoice_items
    ADD COLUMN IF NOT EXISTS comparable_base_unit VARCHAR(2),
    ADD COLUMN IF NOT EXISTS comparable_quantity_base DECIMAL(10,3),
    ADD COLUMN IF NOT EXISTS comparable_unit_price DECIMAL(12,4),
    ADD COLUMN IF NOT EXISTS measurement_source VARCHAR(32),
    ADD COLUMN IF NOT EXISTS measurement_confidence DECIMAL(4,3);

ALTER TABLE invoice_items
    DROP CONSTRAINT IF EXISTS invoice_items_comparable_base_unit_check,
    ADD CONSTRAINT invoice_items_comparable_base_unit_check
      CHECK (comparable_base_unit IS NULL OR comparable_base_unit IN ('kg', 'L')),
    DROP CONSTRAINT IF EXISTS invoice_items_measurement_source_check,
    ADD CONSTRAINT invoice_items_measurement_source_check
      CHECK (measurement_source IS NULL OR measurement_source IN ('description', 'scale_item', 'rule_inference')),
    DROP CONSTRAINT IF EXISTS invoice_items_measurement_confidence_check,
    ADD CONSTRAINT invoice_items_measurement_confidence_check
      CHECK (measurement_confidence IS NULL OR (measurement_confidence >= 0 AND measurement_confidence <= 1)),
    DROP CONSTRAINT IF EXISTS invoice_items_comparable_fields_coherence_check,
    ADD CONSTRAINT invoice_items_comparable_fields_coherence_check
      CHECK (
        (comparable_base_unit IS NULL AND comparable_quantity_base IS NULL AND comparable_unit_price IS NULL)
        OR (comparable_base_unit IS NOT NULL AND comparable_quantity_base IS NOT NULL)
      );

ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_comparable_group_fk,
    ADD CONSTRAINT products_comparable_group_fk
      FOREIGN KEY (comparable_group_id, user_id)
      REFERENCES product_groups(id, user_id)
      ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS product_group_membership_events (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('associate', 'disassociate')),
    changed_by TEXT NOT NULL CHECK (changed_by = 'system' OR changed_by = user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT product_group_membership_events_product_fk
      FOREIGN KEY (product_id, user_id)
      REFERENCES products(id, user_id)
      ON DELETE RESTRICT,
    CONSTRAINT product_group_membership_events_group_fk
      FOREIGN KEY (group_id, user_id)
      REFERENCES product_groups(id, user_id)
      ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_product_groups_user_id ON product_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_products_comparable_group_id ON products(comparable_group_id) WHERE comparable_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_group_membership_events_product_created_at ON product_group_membership_events(user_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_group_membership_events_group_created_at ON product_group_membership_events(user_id, group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_comparable_lookup ON invoice_items(user_id, product_id, comparable_base_unit) WHERE comparable_base_unit IS NOT NULL;

ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_group_membership_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_groups_user_isolation ON product_groups;
CREATE POLICY product_groups_user_isolation ON product_groups
  USING (user_id = app.current_app_user_id())
  WITH CHECK (user_id = app.current_app_user_id());

DROP POLICY IF EXISTS product_group_membership_events_user_isolation ON product_group_membership_events;
CREATE POLICY product_group_membership_events_user_isolation ON product_group_membership_events
  USING (user_id = app.current_app_user_id())
  WITH CHECK (user_id = app.current_app_user_id());
