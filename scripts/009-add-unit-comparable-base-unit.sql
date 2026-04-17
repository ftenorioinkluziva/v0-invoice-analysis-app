-- Adiciona 'un' (unidade) como valor válido de comparable_base_unit
-- Permite comparar preços por unidade (ex: cápsulas de café, ovos, etc.)

-- product_groups: ampliar VARCHAR e atualizar CHECK
ALTER TABLE product_groups
  ALTER COLUMN base_unit TYPE VARCHAR(3);

DO $$
BEGIN
  ALTER TABLE product_groups
    DROP CONSTRAINT IF EXISTS product_groups_base_unit_check;

  ALTER TABLE product_groups
    ADD CONSTRAINT product_groups_base_unit_check
      CHECK (base_unit IN ('kg', 'L', 'un'));
END $$;

-- invoice_items: ampliar VARCHAR e atualizar CHECK
ALTER TABLE invoice_items
  ALTER COLUMN comparable_base_unit TYPE VARCHAR(3);

ALTER TABLE invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_comparable_base_unit_check;

ALTER TABLE invoice_items
  ADD CONSTRAINT invoice_items_comparable_base_unit_check
    CHECK (comparable_base_unit IS NULL OR comparable_base_unit IN ('kg', 'L', 'un'));
