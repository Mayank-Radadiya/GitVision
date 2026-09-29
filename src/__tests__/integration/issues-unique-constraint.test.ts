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

/**
 * T-045 — `syncIssuesAndComments` is now upsert-then-prune instead of
 * delete-then-repull, so the unique constraint above is what a re-sync
 * upserts against. These assertions need a real database because they are
 * about the SQL itself, not the service's control flow.
 */
describe.skipIf(!hasTestDatabase)("issues re-sync (upsert then prune)", () => {
  const ownerId = `user_test_${randomUUID()}`;
  const projectId = randomUUID();

  const insert = (number: number, title: string) => `
    INSERT INTO issues
      (project_id, issue_number, title, state, author_login,
       github_created_at, github_updated_at)
    VALUES
      ('${projectId}', ${number}, '${title}', 'open', 'someone',
       now(), now());
  `;

  const upsert = (number: number, title: string) => `
    INSERT INTO issues
      (project_id, issue_number, title, state, author_login,
       github_created_at, github_updated_at)
    VALUES
      ('${projectId}', ${number}, '${title}', 'open', 'someone',
       now(), now())
    ON CONFLICT (project_id, issue_number) DO UPDATE
      SET title = EXCLUDED.title,
          state = EXCLUDED.state,
          github_updated_at = EXCLUDED.github_updated_at;
  `;

  beforeAll(() => {
    applyMigrations();
    psql(`
      INSERT INTO users (id, email, credits) VALUES ('${ownerId}', '${ownerId}@test.local', 0);
      INSERT INTO projects (id, github_url, owner_id, name)
      VALUES ('${projectId}', 'https://github.com/o/resync', '${ownerId}', 'Resync');
    `);
    psql(insert(1, "first"));
    psql(insert(2, "second"));
    psql(insert(3, "third"));
  });

  afterAll(() => {
    psql(`DELETE FROM users WHERE id = '${ownerId}';`);
  });

  it("updates a re-synced issue in place, keeping its id", () => {
    // Comments hang off issue_id with ON DELETE CASCADE. If the upsert
    // replaced the row instead of updating it, the id would change and a
    // re-sync would silently orphan every comment on the issue.
    const before = psql(`SELECT id FROM issues WHERE project_id = '${projectId}' AND issue_number = 1;`);

    psql(upsert(1, "first, edited"));

    const after = psql(`SELECT id FROM issues WHERE project_id = '${projectId}' AND issue_number = 1;`);
    expect(after).toBe(before);
    expect(
      psql(`SELECT title FROM issues WHERE id = '${before}';`),
    ).toBe("first, edited");
    expect(
      psql(`SELECT count(*) FROM issues WHERE project_id = '${projectId}' AND issue_number = 1;`),
    ).toBe("1");
  });

  it("leaves issues outside a capped sync alone", () => {
    // What `truncated: true` buys: the sync upserts what it saw and does NOT
    // prune, so issues beyond the page cap are neither lost nor touched.
    psql(upsert(1, "capped re-sync"));
    psql(upsert(2, "capped re-sync"));

    expect(
      psql(`SELECT title FROM issues WHERE project_id = '${projectId}' AND issue_number = 3;`),
    ).toBe("third");
  });

  it("prunes only the issues GitHub no longer has", () => {
    psql(`
      DELETE FROM issues
      WHERE project_id = '${projectId}'
        AND issue_number NOT IN (1, 2);
    `);

    const remaining = psql(
      `SELECT string_agg(issue_number::text, ',' ORDER BY issue_number) FROM issues WHERE project_id = '${projectId}';`,
    );
    expect(remaining).toBe("1,2");
  });
});

