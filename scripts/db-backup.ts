import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * GitVision Database Backup Utility
 *
 * Exports a SQL snapshot with `pg_dump`. Requires the PostgreSQL client tools
 * on PATH — there is no in-process fallback, so the script fails loudly if
 * pg_dump is unavailable rather than leaving a partial dump behind.
 *
 * The dump is verified after it is written: a zero-length or obviously
 * truncated file is a worse outcome than no file at all, because a restore
 * looks like it is working until it is not.
 */

/** Tables that must appear in a dump for it to be considered usable. */
const REQUIRED_MARKERS = [
  "CREATE TABLE",
  "projects",
  "project_files",
  "commits",
];

/** A dump below this size is almost certainly an error page or a stub. */
const MIN_PLAUSIBLE_BYTES = 1024;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL environment variable is not defined.");
    process.exit(1);
  }

  const backupDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = path.join(backupDir, `gitvision_backup_${timestamp}.sql`);

  console.log(`📦 Starting database backup to: ${outputFile}`);

  try {
    execSync(`pg_dump "${databaseUrl}" --clean --if-exists -f "${outputFile}"`, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error(
      "❌ pg_dump failed. Install the PostgreSQL client tools and retry.",
    );
    console.error("Error detail:", error);
    process.exit(1);
  }

  // ── Verify the dump is actually restorable ──────────────────────────────
  // A dump that is empty, truncated, or missing core tables would be
  // discovered only during an outage. Check it now.
  if (!fs.existsSync(outputFile)) {
    console.error(`❌ pg_dump reported success but ${outputFile} is missing.`);
    process.exit(1);
  }

  const { size } = fs.statSync(outputFile);
  if (size < MIN_PLAUSIBLE_BYTES) {
    console.error(
      `❌ Dump is only ${size} bytes — this cannot be a real snapshot. Treat the database as unbacked-up.`,
    );
    process.exit(1);
  }

  const contents = fs.readFileSync(outputFile, "utf-8");
  const missing = REQUIRED_MARKERS.filter((marker) => !contents.includes(marker));

  if (missing.length > 0) {
    console.error(
      `❌ Dump is missing expected content: ${missing.join(", ")}. ` +
        `Treat the database as unbacked-up.`,
    );
    process.exit(1);
  }

  console.log(`✅ Verified backup at ${outputFile} (${(size / 1024).toFixed(1)} KB)`);
  console.log(
    `   Restore with: psql "$DATABASE_URL" -f "${path.relative(process.cwd(), outputFile)}"`,
  );
}

main();
