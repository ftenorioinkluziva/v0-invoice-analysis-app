-- Comparable product group suggestions

CREATE TABLE IF NOT EXISTS product_group_suggestions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_product_id INTEGER NOT NULL,
    target_group_id INTEGER NOT NULL,
    confidence DECIMAL(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    reasons JSONB NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
    signals_snapshot JSONB NOT NULL,
    decision_at TIMESTAMP,
    changed_by TEXT NOT NULL CHECK (changed_by = 'system' OR changed_by = user_id),
    change_origin VARCHAR(24) NOT NULL CHECK (change_origin IN ('heuristic', 'recompute', 'accept', 'reject')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT product_group_suggestions_source_product_fk
      FOREIGN KEY (source_product_id, user_id)
      REFERENCES products(id, user_id)
      ON DELETE CASCADE,
    CONSTRAINT product_group_suggestions_target_group_fk
      FOREIGN KEY (target_group_id, user_id)
      REFERENCES product_groups(id, user_id)
      ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_group_suggestions_user_status_created_at
  ON product_group_suggestions(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_group_suggestions_source_target_decision_at
  ON product_group_suggestions(user_id, source_product_id, target_group_id, decision_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_group_suggestions_one_pending_per_source
  ON product_group_suggestions(user_id, source_product_id)
  WHERE status = 'pending';

ALTER TABLE product_group_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_group_suggestions_user_isolation ON product_group_suggestions;
CREATE POLICY product_group_suggestions_user_isolation ON product_group_suggestions
  USING (user_id = app.current_app_user_id())
  WITH CHECK (user_id = app.current_app_user_id());
