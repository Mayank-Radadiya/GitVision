import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, hasTestDatabase, psql, psqlSucceeds } from "../helpers/db";

/**
 * Credits are a real balance. Nothing below defends that at the storage
 * layer: `spendCredits` guards with `WHERE credits >= cost`, so the app cannot
 * overdraw through its own code path, and this constraint is the backstop for
 * anything that bypasses it — a hand-written UPDATE, a script, a future
 * endpoint, or a bug in a WHERE clause.
 */
describe.skipIf(!hasTestDatabase)("users credits constraint", () => {
  const userId = `user_credits_${randomUUID()}`;

  beforeAll(() => {
    applyMigrations();
    psql(`INSERT INTO users (id, email, credits) VALUES ('${userId}', '${userId}@test.local', 5);`);
  });

  afterAll(() => {
    psql(`DELETE FROM users WHERE id = '${userId}';`);
  });

  it("rejects a negative balance", () => {
    expect(psqlSucceeds(`UPDATE users SET credits = -1 WHERE id = '${userId}';`)).toBe(false);
  });

  it("allows zero — a spent balance is valid, a negative one is not", () => {
    expect(psqlSucceeds(`UPDATE users SET credits = 0 WHERE id = '${userId}';`)).toBe(true);
  });

  it("allows a top-up above the starting balance", () => {
    expect(psqlSucceeds(`UPDATE users SET credits = 10 WHERE id = '${userId}';`)).toBe(true);
  });
});

/**
 * The 6 hot-path indexes from audit H12. Each is asserted to exist, because a
 * migration that silently fails to create one is indistinguishable from
 * correct code until production is slow.
 */
describe.skipIf(!hasTestDatabase)("hot-path indexes exist", () => {
  beforeAll(() => {
    applyMigrations();
  });

  const indexExists = (name: string) =>
    psql(`SELECT 1 FROM pg_indexes WHERE indexname = '${name}';`) === "1";

  const indexDefinition = (name: string) =>
    psql(`SELECT indexdef FROM pg_indexes WHERE indexname = '${name}';`);

  it.each([
    // getNeedsAttention filters state = 'open' on every dashboard load.
    ["issues_state_idx", "issues(state) — getNeedsAttention, projectService.ts:759,783"],
    // ORDER BY github_updated_at DESC at projectService.ts:786,837.
    ["issues_github_updated_at_idx", "issues(github_updated_at) — issue feeds, :786,837"],
    // Issues tab filters by project + PR-ness then sorts by recency, :829-837.
    [
      "issues_project_id_is_pull_request_github_updated_at_idx",
      "issues(project_id, is_pull_request, github_updated_at) — issues/PR tab, :829-837",
    ],
    // searchSimilarCodeInFile narrows to one file before ranking, vector-search.ts:268.
    [
      "code_embeddings_project_id_file_path_idx",
      "code_embeddings(project_id, file_path) — searchSimilarCodeInFile, vector-search.ts:258-278",
    ],
    // cleanupStaleData purges expired windows by windowStart, functions.ts:375.
    ["rate_limits_window_start_idx", "rate_limits(window_start) — stale-window cleanup, functions.ts:375"],
    // getCommitChart joins one user's projects to their commits inside a date
    // window. Neither single-column index can serve both, so it scanned every
    // commit in the window — other users' included. projectService.ts:882.
    [
      "commits_project_id_author_date_idx",
      "commits(project_id, author_date) — getCommitChart, projectService.ts:882",
    ],
  ])("%s", (indexName, _why) => {
    expect(indexExists(indexName)).toBe(true);
  });

  /**
   * An index on the wrong columns is a migration that applied cleanly and
   * still does nothing, so the column order is asserted, not just the name.
   * The chart reads one project at a time and then a date range, so
   * project_id has to lead.
   */
  it("commits_project_id_author_date_idx leads with project_id", () => {
    const definition = indexDefinition("commits_project_id_author_date_idx");
    expect(definition).toContain("commits");
    expect(definition).toMatch(/\(project_id, ?author_date\)/);
  });
});
