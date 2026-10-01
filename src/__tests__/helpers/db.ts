import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Throwaway Postgres for migration tests.
 *
 * Gated on TEST_DATABASE_URL so local runs and any environment without a
 * database still pass — the suite skips these files entirely rather than
 * failing. CI points TEST_DATABASE_URL at its pgvector service container.
 *
 * ponytail: shells out to `psql` instead of adding a pg driver dependency.
 * That keeps the test suite dependency-free, at the cost of not supporting
 * transactions or per-row error codes. Add a driver if a test ever needs
 * either.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export const hasTestDatabase = Boolean(TEST_DATABASE_URL);

/** Run SQL against the test database. Throws on any non-zero exit. */
export function psql(sql: string): string {
  if (!TEST_DATABASE_URL) {
    throw new Error("psql() called without TEST_DATABASE_URL set");
  }
  return execFileSync(
    // libpq takes the connection string as a bare positional argument.
    "psql",
    [TEST_DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-q", "-tAc", sql],
    { encoding: "utf8", env: { ...process.env, PGCONNECT_TIMEOUT: "5" } },
  ).trim();
}

/** Does `sql` succeed? Used to assert a constraint is NOT yet enforced. */
export function psqlSucceeds(sql: string): boolean {
  try {
    psql(sql);
    return true;
  } catch {
    return false;
  }
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), "db/migrations");

/**
 * Apply every generated migration, in journal order, exactly the way drizzle
 * would. `--> statement-breakpoint` is drizzle's own separator, so splitting
 * on it reproduces the real apply path rather than a hand-written paraphrase
 * of the schema.
 *
 * Idempotent within a process: the second describe block in a file must not
 * re-run `CREATE TABLE` over tables the first one already made, and a DROP
 * whose target is already gone is a no-op rather than an error. Against a
 * database that was already migrated, DDL is still re-run, so callers that
 * want a pristine database should recreate it (see the workflow).
 */
export function applyMigrations(): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);
  }

  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) {
        try {
          psql(statement);
        } catch (error) {
          // Both messages mean the same thing here: a previous suite already
          // applied this statement, so re-running it has nothing left to do.
          //
          // "already exists" covers CREATE TABLE / ADD CONSTRAINT. "does not
          // exist" covers the reverse — 0007 drops `users.is_pro_user`, which
          // 0000 created, so on a second pass over an already-migrated
          // database the DROP has nothing to drop and errors. That is what
          // broke CI: these integration files each call applyMigrations() in
          // several describe blocks, and the suites share one database, so the
          // second file to run replayed 0007 against a column the first had
          // already removed.
          //
          // Anything else is a real failure and must surface.
          const message = String((error as { stderr?: string }).stderr ?? error);
          if (!/already exists|does not exist/i.test(message)) {
            throw error;
          }
        }
      }
    }
  }
}
