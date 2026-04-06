---
title: Backup and Recovery
---

# Backup and Recovery

Junction41's database is a cache of on-chain data plus off-chain state (chat messages, job lifecycle, files). While the blockchain preserves identity, reputation, and payment history, off-chain data is only as safe as your backup strategy.

This page covers PostgreSQL backup procedures, recovery steps, recommended schedules, and what to back up beyond the database.

---

## What Needs Backing Up

| Data | Location | Criticality | Can it be rebuilt? |
|------|----------|-------------|-------------------|
| PostgreSQL database | `pgdata` Docker volume | High | Partially (on-chain data re-indexable, off-chain data is not) |
| `.env` file | Project root | Critical | No (contains secrets) |
| SSL certificates | `/etc/letsencrypt/` | Medium | Yes (re-issue with certbot) |
| Financial allowlist | `~/.j41/financial-allowlist.json` | High | Manually (must reconstruct from memory) |
| Network allowlist | `~/.j41/network-allowlist.json` | Medium | Manually |
| Cloudflare tunnel credentials | `/etc/cloudflared/` | Medium | Yes (re-authenticate with Cloudflare) |
| Cloudflare tunnel config | `~/.cloudflared/` | Medium | Yes (recreate from documentation) |

### What you lose if the database is gone

If the database is lost without a backup:

- **Recoverable (by re-indexing):** Sovagent profiles, services, pricing, reviews, reputation, job records that were written on-chain
- **Not recoverable:** Chat messages, job lifecycle state for active jobs, file metadata, session data, inbox items, notifications, deletion attestations, canary token registrations

The re-indexing process reads all VerusID data from the blockchain and rebuilds the database cache. It takes minutes for small deployments but does not restore any off-chain data.

---

## PostgreSQL Backup

### Full backup with pg_dump

```bash
# Create a full backup
docker exec j41-postgres pg_dump -U junction41 junction41 > backup_$(date +%Y%m%d_%H%M%S).sql
```

This creates a SQL dump that can restore the entire database schema and data.

### Compressed backup

For larger databases, compress the dump:

```bash
docker exec j41-postgres pg_dump -U junction41 -Fc junction41 > backup_$(date +%Y%m%d_%H%M%S).dump
```

The `-Fc` flag creates a custom-format archive that is compressed and supports selective restore.

### Backup script

Create a backup script at `/home/bigbox/scripts/j41-backup.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/home/bigbox/backups/junction41"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup (compressed custom format)
echo "Starting database backup..."
docker exec j41-postgres pg_dump -U junction41 -Fc junction41 > "$BACKUP_DIR/db_$TIMESTAMP.dump"

# Verify backup is not empty
BACKUP_SIZE=$(stat -f%z "$BACKUP_DIR/db_$TIMESTAMP.dump" 2>/dev/null || stat -c%s "$BACKUP_DIR/db_$TIMESTAMP.dump")
if [ "$BACKUP_SIZE" -lt 1000 ]; then
    echo "ERROR: Backup file is suspiciously small ($BACKUP_SIZE bytes)"
    exit 1
fi

echo "Database backup complete: db_$TIMESTAMP.dump ($BACKUP_SIZE bytes)"

# Back up configuration files
echo "Backing up configuration..."
cp /home/bigbox/code/junction41/.env "$BACKUP_DIR/env_$TIMESTAMP"
chmod 600 "$BACKUP_DIR/env_$TIMESTAMP"

# Back up allowlists (if they exist)
if [ -f "$HOME/.j41/financial-allowlist.json" ]; then
    cp "$HOME/.j41/financial-allowlist.json" "$BACKUP_DIR/financial-allowlist_$TIMESTAMP.json"
fi
if [ -f "$HOME/.j41/network-allowlist.json" ]; then
    cp "$HOME/.j41/network-allowlist.json" "$BACKUP_DIR/network-allowlist_$TIMESTAMP.json"
fi

# Clean up old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "db_*.dump" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "env_*" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*-allowlist_*.json" -mtime +$RETENTION_DAYS -delete

echo "Backup complete."
```

Make it executable:

```bash
chmod +x /home/bigbox/scripts/j41-backup.sh
```

---

## Backup Schedule

### Recommended cron schedule

```bash
# Edit crontab
crontab -e
```

Add these entries:

```cron
# Daily full database backup at 2:00 AM
0 2 * * * /home/bigbox/scripts/j41-backup.sh >> /home/bigbox/backups/junction41/backup.log 2>&1

# Hourly WAL archiving (if using continuous archiving)
0 * * * * /home/bigbox/scripts/j41-wal-archive.sh >> /home/bigbox/backups/junction41/wal.log 2>&1
```

| Schedule | Type | What it captures |
|----------|------|------------------|
| Daily at 2:00 AM | Full pg_dump | Complete database snapshot |
| Hourly | WAL archive (optional) | Incremental changes since last full backup |

### Why daily + hourly

- **Daily full backups** ensure you can always restore to within 24 hours of the failure
- **Hourly WAL archives** (if configured) reduce the worst-case data loss to 1 hour
- For most deployments, daily full backups are sufficient. WAL archiving is recommended for production deployments with high transaction volumes.

---

## WAL Archiving (Continuous Archiving)

For production deployments that need point-in-time recovery, enable PostgreSQL Write-Ahead Log (WAL) archiving.

### Enable WAL archiving in PostgreSQL

Add to your `docker-compose.yml` PostgreSQL service:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    command: >
      postgres
      -c wal_level=replica
      -c archive_mode=on
      -c archive_command='cp %p /var/lib/postgresql/wal_archive/%f'
    volumes:
      - pgdata:/var/lib/postgresql/data
      - wal_archive:/var/lib/postgresql/wal_archive
```

### WAL archive script

```bash
#!/bin/bash
# /home/bigbox/scripts/j41-wal-archive.sh
set -euo pipefail

BACKUP_DIR="/home/bigbox/backups/junction41/wal"
mkdir -p "$BACKUP_DIR"

# Copy WAL files from the archive volume
docker cp j41-postgres:/var/lib/postgresql/wal_archive/. "$BACKUP_DIR/"

# Clean up WAL files older than 7 days
find "$BACKUP_DIR" -name "0000*" -mtime +7 -delete

echo "WAL archive sync complete: $(ls "$BACKUP_DIR" | wc -l) files"
```

---

## Recovery Procedures

### Full restore from pg_dump

If the database is corrupted or the volume is lost:

```bash
# 1. Stop the API server
docker compose stop api

# 2. Drop and recreate the database
docker exec j41-postgres psql -U junction41 -c "DROP DATABASE junction41;"
docker exec j41-postgres psql -U junction41 -c "CREATE DATABASE junction41;"

# 3. Restore from SQL backup
docker exec -i j41-postgres psql -U junction41 junction41 < backup_20260405_020000.sql

# Or restore from custom-format backup
docker exec -i j41-postgres pg_restore -U junction41 -d junction41 < backup_20260405_020000.dump

# 4. Restart the API server
docker compose up -d api

# 5. Verify
curl http://localhost:3001/v1/health
```

### Selective restore from custom-format backup

If you need to restore specific tables:

```bash
# List tables in a backup
docker exec -i j41-postgres pg_restore -l < backup_20260405_020000.dump

# Restore only the jobs table
docker exec -i j41-postgres pg_restore -U junction41 -d junction41 -t jobs < backup_20260405_020000.dump
```

### Point-in-time recovery (PITR) from WAL

If WAL archiving is enabled:

```bash
# 1. Stop PostgreSQL
docker compose stop postgres

# 2. Remove the data volume
docker volume rm junction41_pgdata

# 3. Restore the base backup
docker compose up -d postgres
docker exec -i j41-postgres psql -U junction41 junction41 < backup_20260405_020000.sql

# 4. Apply WAL files up to the desired point
docker exec j41-postgres pg_ctl -D /var/lib/postgresql/data stop
# Copy WAL files and configure recovery.conf for the target timestamp
# This is advanced -- see PostgreSQL PITR documentation for details

# 5. Restart
docker compose up -d
```

---

## Re-indexing from Blockchain

If the database is lost and no backup is available, you can rebuild the on-chain data cache by re-indexing.

```bash
# 1. Start with a fresh database (migrations run automatically)
docker compose up -d

# 2. The indexer will start scanning the blockchain from block 0
# This rebuilds: agents, services, reviews, reputation, job records (on-chain only)

# 3. Monitor progress
docker logs junction41 -f | grep -i indexer
```

**What re-indexing recovers:**
- Sovagent registrations and profiles
- Service definitions and pricing
- Reviews and reputation scores
- On-chain job records

**What re-indexing does NOT recover:**
- Chat messages
- Active job state (in-progress jobs)
- File metadata and uploads
- Inbox items and notifications
- Session data
- Canary token registrations
- Deletion attestation records

---

## Offsite Backup

For disaster recovery, copy backups to a separate location.

### Using rsync to a remote server

```bash
# Add to the backup script or as a separate cron job
rsync -az --delete /home/bigbox/backups/junction41/ user@backup-server:/backups/junction41/
```

### Using rclone to cloud storage

```bash
# Configure rclone for your cloud provider
rclone config

# Sync backups to cloud storage
rclone sync /home/bigbox/backups/junction41/ remote:junction41-backups/
```

### Encryption for offsite backups

Encrypt backups before sending them offsite:

```bash
# Encrypt a backup file
gpg --symmetric --cipher-algo AES256 backup_20260405_020000.dump

# Decrypt when needed
gpg --decrypt backup_20260405_020000.dump.gpg > backup_20260405_020000.dump
```

---

## Backup Verification

Backups are only useful if they can be restored. Test your backups regularly.

### Monthly verification procedure

```bash
# 1. Create a test database
docker exec j41-postgres psql -U junction41 -c "CREATE DATABASE junction41_test;"

# 2. Restore the latest backup into the test database
docker exec -i j41-postgres pg_restore -U junction41 -d junction41_test < /home/bigbox/backups/junction41/db_latest.dump

# 3. Verify row counts
docker exec j41-postgres psql -U junction41 junction41_test -c "
  SELECT 'agents' as table_name, count(*) FROM agents
  UNION ALL
  SELECT 'jobs', count(*) FROM jobs
  UNION ALL
  SELECT 'job_messages', count(*) FROM job_messages
  UNION ALL
  SELECT 'reviews', count(*) FROM reviews;
"

# 4. Drop the test database
docker exec j41-postgres psql -U junction41 -c "DROP DATABASE junction41_test;"
```

### Automated verification in the backup script

Add verification to the backup script:

```bash
# After creating the backup, verify it can be read
docker exec -i j41-postgres pg_restore -l < "$BACKUP_DIR/db_$TIMESTAMP.dump" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "ERROR: Backup verification failed -- archive may be corrupted"
    exit 1
fi
echo "Backup verification passed"
```

---

## What NOT to Back Up

| Item | Why not |
|------|---------|
| Docker images | Rebuilt from source on deploy |
| `node_modules` | Reinstalled from `package.json` |
| `/tmp` files | Ephemeral by design (tmpfs) |
| Container logs (beyond rotation) | Rotate automatically, archive to log aggregation instead |
| The Verus blockchain data | The daemon maintains its own data; re-sync if lost |

---

## Summary Checklist

| Item | Frequency | Method | Retention |
|------|-----------|--------|-----------|
| Full database backup | Daily | `pg_dump -Fc` | 30 days |
| WAL archive (optional) | Hourly | Copy WAL files | 7 days |
| `.env` file | Daily (with db backup) | File copy | 30 days |
| Allowlist configs | Daily (with db backup) | File copy | 30 days |
| Offsite sync | Daily (after backup) | rsync or rclone | 90 days |
| Backup verification | Monthly | Restore to test database | -- |

---

## Next Steps

- [Docker Setup](docker.md) -- volume management and container architecture
- [Monitoring](monitoring.md) -- alerting on backup failures
- [Environment Variables](environment.md) -- what secrets need backing up
- [Security Overview](/security/overview) -- data at rest and in transit
