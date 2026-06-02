#!/bin/sh
set -eu

# Run this on the server to set up automated daily backups.
# Prerequisites: aws CLI installed, S3 credentials configured.
#
# Usage:
#   ssh root@163.172.149.152 < scripts/setup-backup-cron.sh
#
# Or manually:
#   1. SSH into the server
#   2. Install aws CLI: apt-get install -y awscli sqlite3
#   3. Configure credentials:
#        export AWS_ACCESS_KEY_ID=...
#        export AWS_SECRET_ACCESS_KEY=...
#   4. Run this script

# Install dependencies if missing
command -v aws >/dev/null 2>&1 || apt-get install -y awscli
command -v sqlite3 >/dev/null 2>&1 || apt-get install -y sqlite3

# Write the backup script to the server
cat > /usr/local/bin/farmer-backup <<'SCRIPT'
#!/bin/sh
set -eu

VOLUME_PATH="/var/lib/docker/volumes/farmer-data/_data"
DB_FILE="$VOLUME_PATH/farmer.db"
TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
BACKUP_FILE="/tmp/farmer-backup-${TIMESTAMP}.db"

if [ ! -f "$DB_FILE" ]; then
  echo "ERROR: $DB_FILE not found"
  exit 1
fi

sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/farmer-backups/farmer-${TIMESTAMP}.db" \
  --endpoint-url "$S3_ENDPOINT"

rm -f "$BACKUP_FILE"

# Keep only last 30 backups
aws s3 ls "s3://${S3_BUCKET}/farmer-backups/" --endpoint-url "$S3_ENDPOINT" \
  | sort | head -n -30 \
  | awk '{print $4}' \
  | while read -r file; do
      aws s3 rm "s3://${S3_BUCKET}/farmer-backups/$file" --endpoint-url "$S3_ENDPOINT"
    done

echo "$(date -u): Backup done -> farmer-${TIMESTAMP}.db"
SCRIPT

chmod +x /usr/local/bin/farmer-backup

# Write env file for cron (fill these in)
if [ ! -f /etc/farmer-backup.env ]; then
  cat > /etc/farmer-backup.env <<'ENV'
S3_ENDPOINT=https://s3.fr-par.scw.cloud
S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
ENV
  echo ">>> Edit /etc/farmer-backup.env with your S3 credentials"
fi

# Install cron job — daily at 03:00 UTC
CRON_LINE="0 3 * * * . /etc/farmer-backup.env && /usr/local/bin/farmer-backup >> /var/log/farmer-backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v farmer-backup; echo "$CRON_LINE") | crontab -

echo "Backup cron installed. Runs daily at 03:00 UTC."
echo "Test with: . /etc/farmer-backup.env && farmer-backup"
