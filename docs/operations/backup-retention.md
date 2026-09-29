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

### SQL Dumps — Automated
- **Command**: `bun run db:backup` (runs `scripts/db-backup.ts`)
- **Requires**: the PostgreSQL client tools (`pg_dump`) on `PATH`. There is no
  in-process fallback; the script exits non-zero if `pg_dump` is missing.
- **Output Directory**: the script writes to a sibling of the repo
  (`../gitvision-backups/`) by default and refuses to write inside the
  checkout. CI sets `BACKUP_DIR` to the runner's temp directory instead, then
  uploads the result as a workflow artifact.
- **Verification**: the script reopens the dump and refuses to report success
  unless it is over 1 KB and contains `CREATE TABLE` plus the `projects`,
  `project_files` and `commits` tables.
- **Cadence**: daily at 03:17 UTC, from `.github/workflows/backup.yml`
  (`schedule`, plus `workflow_dispatch` for an on-demand dump). The job takes
  the dump and uploads it as a `db-backup` artifact.
- **Retention**: 14 days, per D-12. The workflow artifact is set to 14 days to
  match, and the S3 bucket D-12 chooses carries the same 14-day lifecycle rule.
- **Failure**: the job goes red if `db:backup` exits non-zero. A red backup job
  is the alarm — treat it as a page, not as noise.
- **Known gap**: a GitHub Actions artifact is not the durable home D-12 asks
  for. Until the S3 bucket exists, anything older than 14 days is gone and
  PITR is still the only protection beyond that window. A restore drill is
  also still outstanding: a backup that has never been restored is a
  hypothesis.

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
   - Alternatively, restore using the most recent green `Backup` run's
     `db-backup` artifact, or the newest file in the local output directory:
     ```bash
     psql "$DATABASE_URL" -f ../gitvision-backups/gitvision_backup_<TIMESTAMP>.sql
     ```
2. **Verification Post-Restoration**:
   - Run `bun run db:studio` to check project tables and code embeddings integrity.
