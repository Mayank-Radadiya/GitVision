# GitVision Operations: Backup & Data Retention Policy

## 1. Overview
This document outlines the backup strategy, data retention schedules, and disaster recovery procedures for GitVision's PostgreSQL database on Neon serverless and temporary processing stores.

---

## 2. Database Backup Policy

### Automated Point-in-Time Recovery (PITR)
- **Primary Database**: Hosted on Neon PostgreSQL.
- **PITR Range**: Automatically managed by Neon with point-in-time state restoration up to 14–30 days.

### Manual / Scheduled SQL Dumps
- **Command**: `npm run db:backup` or `bun scripts/db-backup.ts`
- **Output Directory**: `./backups/gitvision_backup_<timestamp>.sql`
- **Recommended Cadence**:
  - Daily automated execution via server cron/CI workflow.
  - Pre-deployment execution before major schema migrations (`npm run db:push`).

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
