-- Performance indexes: pg_trgm for ILIKE search + invoice_items lookup

-- Habilita extensão trigram (necessária para índices GIN em ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice trigram para busca de produtos por nome (ILIKE '%termo%')
-- Torna GET /api/products?search= de full scan para index scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_normalized_name_trgm
  ON products USING GIN (normalized_name gin_trgm_ops);

-- Índice composto para lookup de preço histórico por produto
-- Cobre a subquery/LATERAL: WHERE product_id = X AND user_id = Y ORDER BY purchase_date DESC, id DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_items_product_user_price
  ON invoice_items (product_id, user_id, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_purchase_date_desc
  ON invoices (purchase_date DESC, id DESC);

-- Unique constraint para permitir ON CONFLICT upsert em shopping_list_items
-- Garante que um produto aparece apenas uma vez por lista por usuário
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_shopping_list_items_list_product_user'
  ) THEN
    ALTER TABLE shopping_list_items
      ADD CONSTRAINT uq_shopping_list_items_list_product_user
      UNIQUE (list_id, product_id, user_id);
  END IF;
END
$$;
