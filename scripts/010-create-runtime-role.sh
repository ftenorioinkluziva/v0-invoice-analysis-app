#!/bin/sh
set -eu

runtime_password="${POSTGRES_RUNTIME_PASSWORD:-invoice_runtime_pass}"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=runtime_password="$runtime_password" <<'SQL'
SELECT format(
  'CREATE ROLE invoice_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'runtime_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'invoice_runtime')
\gexec

SELECT format(
  'ALTER ROLE invoice_runtime PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'runtime_password'
)
\gexec
SQL
