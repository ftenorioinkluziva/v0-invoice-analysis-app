-- Enforce user ownership on domain tables
-- This migration guarantees user_id is mandatory for all business data

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM stores WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'stores has rows with NULL user_id';
  END IF;

  IF EXISTS (SELECT 1 FROM products WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'products has rows with NULL user_id';
  END IF;

  IF EXISTS (SELECT 1 FROM invoices WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'invoices has rows with NULL user_id';
  END IF;

  IF EXISTS (SELECT 1 FROM invoice_items WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'invoice_items has rows with NULL user_id';
  END IF;

  IF EXISTS (SELECT 1 FROM shopping_lists WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'shopping_lists has rows with NULL user_id';
  END IF;

  IF EXISTS (SELECT 1 FROM shopping_list_items WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'shopping_list_items has rows with NULL user_id';
  END IF;

  IF EXISTS (SELECT 1 FROM alerts WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'alerts has rows with NULL user_id';
  END IF;

  IF EXISTS (SELECT 1 FROM user_preferences WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'user_preferences has rows with NULL user_id';
  END IF;
END $$;

ALTER TABLE stores ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE invoice_items ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE shopping_lists ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE shopping_list_items ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE alerts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_preferences ALTER COLUMN user_id SET NOT NULL;
