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
- **Output Directory**: `../gitvision-backups/gitvision_backup_<timestamp>.sql`
  by default, or `$BACKUP_DIR` when set. The script refuses to write anywhere
  inside the repository. CI sets `BACKUP_DIR` to the runner's temp directory and
  uploads the result as an artifact.
- **Verification**: the script reopens the dump and refuses to report success
  unless it is over 1 KB and contains `CREATE TABLE` plus the `projects`,
  `project_files` and `commits` tables.
- **Cadence**: daily at 03:17 UTC via `.github/workflows/backup.yml`, plus a
  `workflow_dispatch` trigger for taking a dump on demand.
- **Retention**: 14 days, per D-12. The CI artifact is configured for the same
  14 days, and the S3 bucket is to carry an identical lifecycle rule.
- **On failure**: the job goes red and stays in the Actions history. Treat a red
  `Backup` run as a page, not a warning — a silently-skipped backup is worse
  than a failed one, because the failure never reaches anyone.
- **Known gap**: a GitHub Actions artifact is a copy, not D-12's durable home.
  Past 14 days, PITR remains the only protection, and no restore drill has been
  run yet. A backup that has never been restored is a hypothesis.

---

## 3. Data Retention Policy

| Category | Retention Window | Purge Mechanism | Action |
| :--- | :--- | :--- | :--- |
| **Rate Limit Logs** | 24 Hours | Inngest Cron (`cleanup-stale-data`) | Automatic purge of expired rate limit windows |
| **Orphan Code Embeddings** | No time-based retention | Deleted on re-index or on project deletion | Embeddings for a file are deleted before it is re-embedded; everything belonging to a project is removed by `ON DELETE CASCADE` when the project is deleted. There is no scheduled orphan sweep, so an embedding row survives exactly as long as its project does |
| **Project Files & Commits** | Lifetime of Project | Cascade Delete | Purged on user project removal (`ON DELETE CASCADE`) |

---

## 4. Disaster Recovery & Restoration Procedure

1. **In Case of Database Corruption**:
   - Restore to a specific timestamp using Neon console PITR branching.
   - Alternatively, download the `db-backup` artifact from the most recent green
     `Backup` run in GitHub Actions, then restore from it:
     ```bash
     psql "$DATABASE_URL" -f gitvision_backup_<TIMESTAMP>.sql
     ```
2. **Verification Post-Restoration**:
   - Run `bun run db:studio` to check project tables and code embeddings integrity.
