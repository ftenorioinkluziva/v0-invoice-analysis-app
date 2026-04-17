ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_pack INTEGER;
ALTER TABLE products ADD CONSTRAINT products_units_per_pack_check CHECK (units_per_pack IS NULL OR units_per_pack > 0);
