#!/usr/bin/env bash
# FlashBooker on-demand backup.
# Captures: pg schema, pg data, full custom-format dump, both storage buckets, a manifest.
#
# Required env:
#   SUPABASE_DB_URL          — postgres connection string with service-role privileges
#                              (Supabase Dashboard → Project Settings → Database → Connection string → URI)
#   NEXT_PUBLIC_SUPABASE_URL — used to mirror storage via supabase CLI
#   SUPABASE_SERVICE_ROLE_KEY
#
# Optional:
#   BACKUP_DIR (default: ./backups)
#
# Usage: ./deploy/backup-now.sh

set -euo pipefail
cd "$(dirname "$0")/.."

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL must be set (Postgres URI)}"
: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL must be set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY must be set}"

# Allow loading from .env.local for convenience
if [[ -f .env.local ]]; then set -a; . ./.env.local; set +a; fi

BACKUP_ROOT="${BACKUP_DIR:-./backups}"
TS=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
DEST="$BACKUP_ROOT/$TS"
mkdir -p "$DEST"

echo "==> Backup target: $DEST"

# ---------- Postgres ----------
echo "==> pg_dump schema"
pg_dump --schema-only --no-owner --no-privileges "$SUPABASE_DB_URL" > "$DEST/schema.sql"

echo "==> pg_dump data (inserts)"
pg_dump --data-only --inserts --no-owner --no-privileges \
  --exclude-schema=storage --exclude-schema=auth \
  "$SUPABASE_DB_URL" > "$DEST/data.sql"

echo "==> pg_dump full (custom format, used for restore)"
pg_dump -Fc --no-owner --no-privileges "$SUPABASE_DB_URL" > "$DEST/full.dump"

# ---------- Row counts for manifest ----------
echo "==> sampling row counts"
ROWS=$(psql "$SUPABASE_DB_URL" -At -F '|' <<'SQL'
SELECT relname || '|' || n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;
SQL
)

# ---------- Storage buckets ----------
# We download via the Supabase REST API (no supabase CLI required).
download_bucket() {
  local bucket="$1"
  local out="$DEST/$bucket"
  mkdir -p "$out"
  echo "==> mirroring storage bucket: $bucket"

  # List all files (paginated)
  local offset=0
  while :; do
    listing=$(curl -sS -X POST \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"prefix\":\"\",\"limit\":1000,\"offset\":$offset}" \
      "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/list/$bucket")
    count=$(echo "$listing" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)
    if [[ "$count" == "0" ]]; then break; fi

    echo "$listing" | python3 -c '
import json, sys
for f in json.load(sys.stdin):
    print(f["name"])
' | while read -r name; do
      mkdir -p "$out/$(dirname "$name")"
      curl -sS -L \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -o "$out/$name" \
        "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/$bucket/$name"
    done
    offset=$((offset + count))
    [[ "$count" -lt 1000 ]] && break
  done
}

download_bucket "artist-assets" || echo "  (artist-assets bucket missing or empty)"
download_bucket "reference-images" || echo "  (reference-images bucket missing or empty)"

# ---------- Manifest ----------
GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

cat > "$DEST/manifest.json" <<EOF
{
  "timestamp": "$TS",
  "git_sha": "$GIT_SHA",
  "git_branch": "$GIT_BRANCH",
  "supabase_url": "$NEXT_PUBLIC_SUPABASE_URL",
  "row_counts": [
$(echo "$ROWS" | awk -F'|' '{printf "    {\"table\":\"%s\",\"rows\":%s},\n", $1, $2}' | sed '$ s/,$//')
  ]
}
EOF

# ---------- Done ----------
SIZE=$(du -sh "$DEST" | awk '{print $1}')
echo "==> Done. $DEST ($SIZE)"
echo "    Restore with:"
echo "      pg_restore --no-owner --no-privileges -d \"\$TARGET_DB_URL\" $DEST/full.dump"
