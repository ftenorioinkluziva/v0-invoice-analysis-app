\set ON_ERROR_STOP on

SELECT id AS user_a
FROM "user"
ORDER BY id
LIMIT 1
\gset

SELECT id AS user_b
FROM "user"
ORDER BY id
OFFSET 1
LIMIT 1
\gset

BEGIN;

SELECT set_config('app.user_id', :'user_a', true);
INSERT INTO stores (cnpj, name, user_id)
VALUES ('ARQ01-RLS-PROBE', 'Tenant A', :'user_a');

SELECT set_config('app.user_id', :'user_b', true);
SELECT count(*) AS tenant_a_rows_visible_to_tenant_b
FROM stores
WHERE name = 'Tenant A';

INSERT INTO stores (cnpj, name, user_id)
VALUES ('ARQ01-RLS-PROBE', 'Tenant B', :'user_b');

SELECT count(*) AS tenant_b_rows_visible
FROM stores
WHERE cnpj = 'ARQ01-RLS-PROBE';

ROLLBACK;
