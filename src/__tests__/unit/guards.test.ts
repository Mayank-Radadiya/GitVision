/**
 * Tenant-isolation guards.
 *
 * `assertProjectOwnership` is the single choke point in front of every
 * project-scoped read and mutation, and `verifyOwnership` is its tRPC
 * counterpart. Both encode the same rule: the query itself is scoped by
 * ownerId, so a non-owner gets the same "not found" result as a genuinely
 * missing project — no existence oracle.
 *
 * These tests assert the *shape* of the query (that ownerId is part of the
 * WHERE clause) as well as the behaviour, because a future refactor that
 * moved the ownership check back into JS would still pass a behaviour-only
 * test.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/** Every `eq(column, value)` pair the guard built, in order. */
let eqCalls: { column: unknown; value: unknown }[] = [];
/** Rows the mocked project lookup resolves to. */
let lookupResult: unknown[] = [];

function chain(rows: unknown[]) {
  const builder: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
  };
  for (const method of [
    "select",
    "from",
    "where",
    "limit",
    "orderBy",
    "set",
    "values",
    "returning",
    "insert",
    "update",
    "delete",
  ]) {
    builder[method] = () => builder;
  }
  return builder;
}

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => chain(lookupResult),
      }),
    }),
  },
}));

import { assertProjectOwnership, ProjectAccessError } from "@/src/lib/guards";
import { projectTables } from "@/db/schema";

const OWNED = { id: "proj_1", ownerId: "user_owner" };

// Spy on `eq` so the test can see which columns the guard filtered by without
// reaching into Drizzle's SQL object graph (which is circular and private).
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (column: unknown, value: unknown) => {
      eqCalls.push({ column, value });
      return actual.eq(column as never, value as never);
    },
  };
});

beforeEach(() => {
  eqCalls = [];
  lookupResult = [];
});

describe("assertProjectOwnership", () => {
  it("returns the project when the caller owns it", async () => {
    lookupResult = [OWNED];

    await expect(
      assertProjectOwnership("proj_1", "user_owner"),
    ).resolves.toMatchObject({ id: "proj_1" });
  });

  it("scopes the query by ownerId, not by a post-fetch comparison", async () => {
    lookupResult = [OWNED];

    await assertProjectOwnership("proj_1", "user_owner");

    // Both the project id and the owner must be part of the WHERE clause —
    // not the owner, applied in JS after the fetch.
    const values = eqCalls.map((call) => call.value);
    expect(values).toContain("proj_1");
    expect(values).toContain("user_owner");

    // And the owner predicate must be on the ownerId column specifically.
    const ownerPredicate = eqCalls.find(
      (call) => call.value === "user_owner",
    );
    expect(ownerPredicate?.column).toBe(projectTables.ownerId);
  });

  it("throws ProjectAccessError when the project does not exist", async () => {
    lookupResult = [];

    await expect(
      assertProjectOwnership("proj_missing", "user_owner"),
    ).rejects.toBeInstanceOf(ProjectAccessError);
  });

  it("throws the same error for a project owned by someone else", async () => {
    // The query is scoped, so a non-owner is indistinguishable from a
    // missing project. This is the property that prevents an existence oracle.
    lookupResult = [];

    await expect(
      assertProjectOwnership("proj_1", "user_attacker"),
    ).rejects.toBeInstanceOf(ProjectAccessError);
  });

  it("does not leak the project id or owner id in the error", async () => {
    lookupResult = [];

    const error = (await assertProjectOwnership(
      "proj_1",
      "user_attacker",
    ).catch((e: unknown) => e)) as Error;

    expect(error).toBeInstanceOf(ProjectAccessError);
    expect(error.message).not.toContain("proj_1");
    expect(error.message).not.toContain("user_attacker");
  });
});
