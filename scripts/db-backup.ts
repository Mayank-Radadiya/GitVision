import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * GitVision Database Backup Utility
 * Exports database snapshot using pg_dump if available or dumps tables via Node process.
 */
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
    // Attempt pg_dump first
    execSync(`pg_dump "${databaseUrl}" --clean --if-exists -f "${outputFile}"`, {
      stdio: "inherit",
    });
    console.log(`✅ Backup successfully created at ${outputFile}`);
  } catch (error) {
    console.warn(
      "⚠️  pg_dump CLI not available or failed. Ensure pg_dump is installed for full SQL dump.",
    );
    console.error("Error detail:", error);
    process.exit(1);
  }
}

main();
