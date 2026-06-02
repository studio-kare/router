#!/bin/sh
set -eu

# Backs up farmer.db from the Docker volume and uploads to S3-compatible storage.
# Requires: aws CLI configured with S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

VOLUME_PATH="/var/lib/docker/volumes/farmer-data/_data"
DB_FILE="$VOLUME_PATH/farmer.db"
TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
BACKUP_FILE="/tmp/farmer-backup-${TIMESTAMP}.db"

if [ ! -f "$DB_FILE" ]; then
  echo "ERROR: $DB_FILE not found"
  exit 1
fi

# Use sqlite3 .backup for a consistent snapshot (safe even while db is in use)
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"
else
  # Fallback: copy with WAL checkpoint
  cp "$DB_FILE" "$BACKUP_FILE"
  [ -f "${DB_FILE}-wal" ] && cp "${DB_FILE}-wal" "${BACKUP_FILE}-wal"
fi

# Upload to S3
aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/farmer-backups/farmer-${TIMESTAMP}.db" \
  --endpoint-url "$S3_ENDPOINT"

# Clean up
rm -f "$BACKUP_FILE" "${BACKUP_FILE}-wal"

echo "Backup uploaded: s3://${S3_BUCKET}/farmer-backups/farmer-${TIMESTAMP}.db"
