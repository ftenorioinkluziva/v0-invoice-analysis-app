-- ARQ-01: separate the migration owner from the runtime role and make tenant RLS fail closed.
-- This migration expects scripts/010-create-runtime-role.sh to have created invoice_runtime.

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_app_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '');
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public, app TO invoice_runtime;
GRANT EXECUTE ON FUNCTION app.current_app_user_id() TO invoice_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO invoice_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO invoice_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO invoice_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO invoice_runtime;

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores FORCE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items FORCE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists FORCE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items FORCE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'product_groups',
    'product_group_membership_events',
    'product_group_suggestions'
  ]
  LOOP
    IF to_regclass('public.' || tenant_table) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    END IF;
  END LOOP;
END $$;

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_cnpj_key;
CREATE UNIQUE INDEX IF NOT EXISTS stores_user_cnpj_key
  ON stores (user_id, cnpj)
  WHERE cnpj IS NOT NULL;

COMMIT;
