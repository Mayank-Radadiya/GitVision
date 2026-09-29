import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyMigrations,
  hasTestDatabase,
  psql,
  psqlSucceeds,
} from "../helpers/db";

/**
 * T19 — the `issues` table must reject a second row for the same
 * (project_id, issue_number).
 *
 * `syncIssues` deletes and re-pulls a project's issues. Without a unique
 * constraint a re-pull that runs twice (retry, double click, overlapping
 * Inngest event) silently doubles every issue, and nothing else in the schema
 * notices: the two rows have distinct uuids.
 */
describe.skipIf(!hasTestDatabase)("issues (project_id, issue_number) uniqueness", () => {
  const ownerId = `user_test_${randomUUID()}`;
  const projectA = randomUUID();
  const projectB = randomUUID();
  const issueNumber = 4242;

  const insertIssue = (projectId: string, number: number) => `
    INSERT INTO issues
      (project_id, issue_number, title, state, author_login,
       github_created_at, github_updated_at)
    VALUES
      ('${projectId}', ${number}, 'dup probe', 'open', 'someone',
       now(), now());
  `;

  beforeAll(() => {
    applyMigrations();
    psql(`
      INSERT INTO users (id, email, credits) VALUES ('${ownerId}', '${ownerId}@test.local', 0);
      INSERT INTO projects (id, github_url, owner_id, name)
      VALUES ('${projectA}', 'https://github.com/o/a', '${ownerId}', 'A'),
             ('${projectB}', 'https://github.com/o/b', '${ownerId}', 'B');
    `);
  });

  afterAll(() => {
    // Children cascade from projects; the projects cascade from the user.
    psql(`DELETE FROM users WHERE id = '${ownerId}';`);
  });

  it("rejects a second issue with the same project_id and issue_number", () => {
    psql(insertIssue(projectA, issueNumber));

    expect(psqlSucceeds(insertIssue(projectA, issueNumber))).toBe(false);
  });

  it("still allows the same issue_number in a different project", () => {
    // issue_number is only unique WITHIN a project — GitHub restarts its
    // numbering per repository, so a global unique index would reject
    // perfectly valid data.
    expect(psqlSucceeds(insertIssue(projectB, issueNumber))).toBe(true);
  });

  it("still allows a different issue_number in the same project", () => {
    expect(psqlSucceeds(insertIssue(projectA, issueNumber + 1))).toBe(true);
  });
});
