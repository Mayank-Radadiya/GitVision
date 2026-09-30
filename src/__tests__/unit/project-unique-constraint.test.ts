import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { projectTables } from "@/db/schema";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * F-25 — one repository per (owner, githubUrl).
 *
 * The constraint lives in the schema, but every test that actually exercised
 * it needed a live database, so the whole file was `describe.skipIf`ed in any
 * environment without one. Deleting the constraint from `db/schema.ts`
 * therefore left the suite fully green. These two pins close that hole: the
 * first reads the table config with no connection at all, the second checks
 * the migration that created it in the database.
 */
describe("F-25 — (owner_id, github_url) uniqueness", () => {
  const config = getTableConfig(projectTables);
  const columns = config.columns.map((c) => c.name);
  // Drizzle accepts either a column name or a Column object in `unique()`,
  // and reports back whatever was passed, so normalise before comparing.
  const uniques = config.uniqueConstraints.map((u) => ({
    name: u.name,
    columns: u.columns.map((c) => (typeof c === "string" ? c : c.name)),
  }));

  it("declares a unique constraint over exactly ownerId and githubUrl", () => {
    const match = uniques.find(
      (u) =>
        u.name === "projects_owner_id_github_url_unique" &&
        u.columns.length === 2,
    );

    expect(
      match,
      `no 2-column constraint named projects_owner_id_github_url_unique; found ${JSON.stringify(
        uniques.map((u) => ({ name: u.name, columns: u.columns })),
      )}`,
    ).toBeDefined();

    // Order is irrelevant to uniqueness, but both columns must be the ones
    // that matter — a constraint on (owner_id, github_url, name) would not
    // stop the duplicate it exists to stop. Drizzle reports the database
    // names here, not the TypeScript property names.
    expect([...match!.columns].sort()).toEqual(["github_url", "owner_id"]);
  });

  it("covers the columns the constraint is named for", () => {
    expect(columns).toEqual(
      expect.arrayContaining(["owner_id", "github_url"]),
    );
  });

  it("has the migration that applies it, not just the Drizzle declaration", () => {
    // Drizzle's `unique()` and the SQL constraint are declared separately. A
    // schema-only constraint is a comment until a migration exists, and the
    // 23505 the service branch keys on comes from the database, not the ORM.
    const sql = readFileSync(
      resolve(process.cwd(), "db/migrations/0005_flawless_ultragirl.sql"),
      "utf8",
    );

    expect(sql).toContain(
      'ADD CONSTRAINT "projects_owner_id_github_url_unique"',
    );
    expect(sql).toMatch(/UNIQUE\s*\(\s*"owner_id"\s*,\s*"github_url"\s*\)/);
  });
});
