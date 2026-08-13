\set ON_ERROR_STOP on

SELECT p.user_id AS tenant_id, p.id AS product_id
FROM products p
ORDER BY p.id
LIMIT 1
\gset

BEGIN;
SELECT set_config('app.user_id', :'tenant_id', true);

INSERT INTO alerts (product_id, alert_type, message, data, user_id, dedupe_key)
VALUES (:'product_id', 'price_increase', 'ARQ04 probe', '{}'::jsonb, :'tenant_id', 'ARQ04-PROBE')
ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
RETURNING id AS first_alert_id;

INSERT INTO alerts (product_id, alert_type, message, data, user_id, dedupe_key)
VALUES (:'product_id', 'price_increase', 'ARQ04 probe duplicate', '{}'::jsonb, :'tenant_id', 'ARQ04-PROBE')
ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
RETURNING id AS second_alert_id;

SELECT count(*) AS visible_probe_rows
FROM alerts
WHERE user_id = :'tenant_id' AND dedupe_key = 'ARQ04-PROBE';

ROLLBACK;
