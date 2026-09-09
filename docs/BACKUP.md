# RIVÉ Database Backup & Recovery Strategy

This document outlines the database backup, Point-in-Time Recovery (PITR), and disaster recovery procedures for the RIVÉ backend PostgreSQL database on **Neon**.

---

## 1. Neon Native Capabilities

Neon provides built-in snapshot and Point-in-Time Recovery (PITR) mechanisms at the storage engine level (pageserver / safekeepers):

### Free Tier Plan
* **PITR Window:** 24 hours of continuous history.
* **Database Branching:** Instant branching to any point within the 24-hour history window without copying data.
* **Storage Limit:** Up to 0.5 GiB per project.

### Launch & Scale Paid Plans
* **PITR Window:** Configurable retention from **7 days up to 30 days**.
* **WAL Retention:** Continuous Write-Ahead Log (WAL) streaming and persistent archiving.
* **Instant Branching:** Create isolated staging/development environments or restore points in seconds.

---

## 2. Identified Gaps & Risk Analysis

While Neon's native storage layer provides automatic PITR for operational recovery (such as accidental `DROP TABLE` or faulty migrations within the retention window), the following gaps exist:

1. **Long-Term Compliance Archival:** Retention past the 24-hour (Free) or 30-day (Paid) PITR window is not maintained automatically by Neon.
2. **Project / Account Level Deletion:** If a Neon project or cloud account is accidentally removed, native snapshots are lost.
3. **Cross-Region Offsite Redundancy:** Native snapshots reside in the same primary Neon region.

---

## 3. Manual Backup Procedure (Offsite / Safety Net)

A manual backup script is provided in the repository at `scripts/backup-db.sh`. It uses `pg_dump` and `gzip` to generate clean, portable compressed SQL dumps.

### Prerequisites
* `postgresql-client` (`pg_dump` version matching PostgreSQL 16)
* `DIRECT_DATABASE_URL` or `DATABASE_URL` set in environment

### Executing a Manual Backup

```bash
# 1. Export your direct database connection string (use directUrl for direct access)
export DIRECT_DATABASE_URL="postgresql://user:password@ep-example-123456.us-east-2.aws.neon.tech/rive_backend?sslmode=require"

# 2. Run the backup script
./scripts/backup-db.sh

# Custom output file path:
./scripts/backup-db.sh ./backups/custom_backup.sql.gz
```

---

## 4. Database Restore Procedure

To restore a compressed `.sql.gz` backup to a fresh PostgreSQL database or Neon branch:

```bash
# 1. Set target database connection URL
export TARGET_DB_URL="postgresql://user:password@ep-example-123456.us-east-2.aws.neon.tech/rive_backend?sslmode=require"

# 2. Decompress and restore via psql
gunzip -c ./backups/rive_backup_20260909_120000.sql.gz | psql "${TARGET_DB_URL}"

# 3. Apply schema migrations if necessary
npx prisma migrate deploy
```
