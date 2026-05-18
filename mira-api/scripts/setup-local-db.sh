#!/usr/bin/env bash
# Setup PostgreSQL for Mira API without Docker (Homebrew Postgres on macOS).
set -euo pipefail

DB_NAME="${MIRA_DB_NAME:-mira_db}"
DB_USER="${MIRA_DB_USER:-mira}"
DB_PASS="${MIRA_DB_PASS:-mira_secret}"

echo "→ Creating role and database (if missing)..."

psql postgres -v ON_ERROR_STOP=0 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SQL

if ! psql -lqt | cut -d \| -f 1 | grep -qw "${DB_NAME}"; then
  createdb -O "${DB_USER}" "${DB_NAME}" 2>/dev/null || createdb "${DB_NAME}"
  echo "→ Created database: ${DB_NAME}"
else
  echo "→ Database already exists: ${DB_NAME}"
fi

echo ""
echo "✓ Done. Use in .env:"
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
