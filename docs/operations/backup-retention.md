# GitVision Operations: Backup & Data Retention Policy

## 1. Overview
This document outlines the backup strategy, data retention schedules, and disaster recovery procedures for GitVision's PostgreSQL database on Neon serverless and temporary processing stores.

---

## 2. Database Backup Policy

### Automated Point-in-Time Recovery (PITR)
- **Primary Database**: Hosted on Neon PostgreSQL.
- **PITR Range**: Managed by Neon, and the retention window depends on the
  plan you are on. **Confirm this against your Neon dashboard** — it is not
  configured from this repository, and this document previously stated a
  14–30 day window that nothing here could enforce.

### SQL Dumps — MANUAL ONLY
- **Command**: `npm run db:backup` (runs `scripts/db-backup.ts`)
- **Requires**: the PostgreSQL client tools (`pg_dump`) on `PATH`. There is no
  in-process fallback; the script exits non-zero if `pg_dump` is missing.
- **Output Directory**: `./backups/gitvision_backup_<timestamp>.sql` (gitignored)
- **Verification**: the script reopens the dump and refuses to report success
  unless it is over 1 KB and contains `CREATE TABLE` plus the `projects`,
  `project_files` and `commits` tables.
- **Cadence**: *nobody runs this automatically.* There is no cron and no CI
  step that takes a dump. Until one exists, PITR is your only real protection
  and a dump happens only when a human remembers.
- **To automate**: add a scheduled job that runs `bun run db:backup` and
  uploads the file to object storage. Dumps written to the deploy machine's
  local disk are lost when that machine is replaced.

---

## 3. Data Retention Policy

| Category | Retention Window | Purge Mechanism | Action |
| :--- | :--- | :--- | :--- |
| **Rate Limit Logs** | 24 Hours | Inngest Cron (`cleanup-stale-data`) | Automatic purge of expired rate limit windows |
| **Orphan Code Embeddings** | 30 Days | Inngest RAG Pipeline | Deleted upon project re-indexing or manual project deletion |
| **Project Files & Commits** | Lifetime of Project | Cascade Delete | Purged on user project removal (`ON DELETE CASCADE`) |

---

## 4. Disaster Recovery & Restoration Procedure

1. **In Case of Database Corruption**:
   - Restore to a specific timestamp using Neon console PITR branching.
   - Alternatively, restore using the latest SQL backup file:
     ```bash
     psql "$DATABASE_URL" -f backups/gitvision_backup_<TIMESTAMP>.sql
     ```
2. **Verification Post-Restoration**:
   - Run `npm run db:studio` to check project tables and code embeddings integrity.
