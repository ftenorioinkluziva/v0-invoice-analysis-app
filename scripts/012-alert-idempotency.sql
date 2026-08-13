-- ARQ-04: make derived price alerts safe to retry.

BEGIN;

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS alerts_user_dedupe_key
  ON alerts (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

COMMIT;
