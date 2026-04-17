-- RLS hardening (incremental-safe)
-- Observação: enquanto app.user_id não for setado na sessão, as policies abaixo mantêm compatibilidade.
-- Quando app.user_id estiver presente, a policy força isolamento por user_id.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_app_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '');
$$;

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stores_user_isolation ON stores;
CREATE POLICY stores_user_isolation ON stores
  USING (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
  WITH CHECK (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id());

DROP POLICY IF EXISTS products_user_isolation ON products;
CREATE POLICY products_user_isolation ON products
  USING (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
  WITH CHECK (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id());

DROP POLICY IF EXISTS invoices_user_isolation ON invoices;
CREATE POLICY invoices_user_isolation ON invoices
  USING (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
  WITH CHECK (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id());

DROP POLICY IF EXISTS invoice_items_user_isolation ON invoice_items;
CREATE POLICY invoice_items_user_isolation ON invoice_items
  USING (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
  WITH CHECK (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id());

DROP POLICY IF EXISTS shopping_lists_user_isolation ON shopping_lists;
CREATE POLICY shopping_lists_user_isolation ON shopping_lists
  USING (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
  WITH CHECK (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id());

DROP POLICY IF EXISTS shopping_list_items_user_isolation ON shopping_list_items;
CREATE POLICY shopping_list_items_user_isolation ON shopping_list_items
  USING (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
  WITH CHECK (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id());

DROP POLICY IF EXISTS alerts_user_isolation ON alerts;
CREATE POLICY alerts_user_isolation ON alerts
  USING (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
  WITH CHECK (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id());

DROP POLICY IF EXISTS user_preferences_user_isolation ON user_preferences;
CREATE POLICY user_preferences_user_isolation ON user_preferences
  USING (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
  WITH CHECK (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_groups') THEN
    ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS product_groups_user_isolation ON product_groups;
    EXECUTE '
      CREATE POLICY product_groups_user_isolation ON product_groups
        USING (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
        WITH CHECK (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
    ';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_group_membership_events') THEN
    ALTER TABLE product_group_membership_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS product_group_membership_events_user_isolation ON product_group_membership_events;
    EXECUTE '
      CREATE POLICY product_group_membership_events_user_isolation ON product_group_membership_events
        USING (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
        WITH CHECK (app.current_app_user_id() IS NULL OR user_id = app.current_app_user_id())
    ';
  END IF;
END $$;
