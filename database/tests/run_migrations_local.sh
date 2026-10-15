#!/usr/bin/env bash
# Rejoue TOUTES les migrations du dépôt, dans l'ordre, sur une base PostgreSQL+PostGIS jetable
# (avec supabase_stub.sql). Usage: DB=smartcity_test PSQL="psql -U postgres" ./run_migrations_local.sh
# Échoue (code ≠ 0) à la première erreur SQL.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
DB="${DB:-smartcity_test}"; PSQL="${PSQL:-psql -U postgres}"
$PSQL -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" >/dev/null
$PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f "$HERE/supabase_stub.sql"
$PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -c "ALTER DATABASE $DB SET search_path = \"\$user\", public, extensions"
for f in $(ls "$ROOT"/supabase/migrations/*.sql | sort); do
  echo ">> $(basename "$f")"
  $PSQL -v ON_ERROR_STOP=1 -q -1 -d "$DB" -f "$f" 2>&1 | grep -vE '^(NOTICE|psql:.*NOTICE)' || true
  rc=${PIPESTATUS[0]}; [ "$rc" -eq 0 ] || { echo "ÉCHEC: $f (rc=$rc)"; exit "$rc"; }
done
echo "OK: toutes les migrations ont été appliquées."
