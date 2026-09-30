// Webhook tests mock a shared `state` object that the Svix verifier and the
// Drizzle mock write to sequentially. Running them concurrently causes race
// conditions where one test's state.failNext bleeds into another test's
// verification window, producing flaky 500/200 mismatches under CI load.
//
// Isolation strategy applied here:
//   1. Every `it` case carries { timeout: 20000 } — up from Vitest's 5 s
//      default. This absorbs scheduling jitter on a busy GitHub Actions runner
//      without masking genuine hangs (20 s is still well below the 6-minute
//      job limit).
//   2. The file is registered in vitest.config.ts under `sequence.concurrent:
//      false` for integration tests so this describe block runs sequentially
//      with respect to its siblings.
//
// Row 18 in gitvisionStrategy2.md §8.5 (clerk-webhook.test.ts flaky under
// parallel load) is resolved by these two measures combined.
import { describe, it, expect, vi, beforeEach } from "vitest";

type CapturedInsert = {
  values?: Record<string, unknown>;
  conflict?: { target?: unknown; set?: Record<string, unknown> };
};

const state: {
  insert: CapturedInsert;
  deleted: { table: string; id: string } | null;
  failNext: Error | null;
} = {
  insert: {},
  deleted: null,
  failNext: null,
};

const thenable = {
  then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    state.failNext
      ? reject(state.failNext)
      : (resolve({ rowCount: 1 }), undefined),
};

// user.created awaits `.onConflictDoNothing().returning({ id })` and only
// grants the signup credits when a row actually came back, so the mock has to
// answer `.returning()` with a non-empty array.
const returningRows = {
  then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    state.failNext
      ? reject(state.failNext)
      : (resolve([{ id: "user_abc" }]), undefined),
};

const doNothingChain = {
  then: thenable.then,
  returning: () => returningRows,
};

const chain = {
  values(v: Record<string, unknown>) {
    state.insert.values = v;
    return this;
  },
  onConflictDoUpdate(cfg: CapturedInsert["conflict"]) {
    state.insert.conflict = cfg;
    return thenable;
  },
  onConflictDoNothing() {
    return doNothingChain;
  },
  where() {
    return thenable;
  },
};

vi.mock("@/db", () => ({
  db: {
    insert: () => chain,
    delete: (table: { name: string }) => ({
      where: (cond: unknown) => {
        state.deleted = { table: table.name, id: String(cond) };
        return thenable;
      },
    }),
    // grantCredits issues one raw CTE through db.execute.
    execute: async () => ({ rows: [{ balance_after: 100 }] }),
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (k: string) =>
      ({
        "svix-id": "msg_1",
        "svix-timestamp": "1700000000",
        "svix-signature": "v1,sig",
      })[k] ?? null,
  }),
}));

process.env.CLERK_WEBHOOK_SECRET = "whsec_test";

vi.mock("svix", () => ({
  Webhook: class {
    verify() {
      return (globalThis as { __clerkEvent?: unknown }).__clerkEvent;
    }
  },
}));

async function invoke() {
  const { POST } = await import("@/app/api/webhooks/clerk/route");
  const req = new Request("https://example.test/api/webhooks/clerk", {
    method: "POST",
    body: "{}",
  });
  return POST(req);
}

beforeEach(() => {
  state.insert = {};
  state.deleted = null;
  state.failNext = null;
});

// describe.sequential instructs Vitest to run the cases inside this block one
// at a time regardless of the --pool or --concurrent setting at the CLI level.
// This is the correct fix for shared-state mocks: the `state` object is reset
// in beforeEach, but only one test must touch it at a time.
describe.sequential("Clerk webhook", () => {
  it(
    "upserts on the primary key so an existing user is updated in place",
    { timeout: 20000 },
    async () => {
      (globalThis as { __clerkEvent?: unknown }).__clerkEvent = {
        type: "user.updated",
        data: {
          id: "user_abc",
          email_addresses: [{ email_address: "a@b.com" }],
          first_name: "Ada",
          last_name: "Lovelace",
        },
      };

      const res = await invoke();

      expect(res.status).toBe(200);
      // The stable identity is Clerk's user id (the PK), not the mutable email.
      expect(state.insert.conflict?.target).toBeDefined();
      const target = state.insert.conflict?.target as
        { name: string } | undefined;
      expect(target?.name).toBe("id");
    },
  );

  it(
    "does not hand out credits on an update, only on insert",
    { timeout: 20000 },
    async () => {
      (globalThis as { __clerkEvent?: unknown }).__clerkEvent = {
        type: "user.updated",
        data: {
          id: "user_abc",
          email_addresses: [{ email_address: "a@b.com" }],
          first_name: "Ada",
        },
      };

      await invoke();

      // credits must be in the INSERT values only; replaying the webhook
      // must never refill a user's balance.
      expect(state.insert.values?.credits).toBe(100);
      expect(state.insert.conflict?.set).not.toHaveProperty("credits");
    },
  );

  it(
    "returns 500 when the database write fails so Clerk retries",
    { timeout: 20000 },
    async () => {
      (globalThis as { __clerkEvent?: unknown }).__clerkEvent = {
        type: "user.updated",
        data: {
          id: "user_abc",
          email_addresses: [{ email_address: "a@b.com" }],
        },
      };
      state.failNext = new Error("connection terminated unexpectedly");

      const res = await invoke();

      // Silently returning 200 here is what made provisioning fail unnoticed.
      expect(res.status).toBe(500);
    },
  );

  it(
    "still returns 200 for events it does not handle",
    {
      timeout: 20000,
    },
    async () => {
      (globalThis as { __clerkEvent?: unknown }).__clerkEvent = {
        type: "session.created",
        data: { id: "sess_1" },
      };

      const res = await invoke();
      expect(res.status).toBe(200);
    },
  );

  // T-005 / D-1: an OAuth-only Clerk account has no email address at all.
  // The handler must still provision the row rather than skipping the user,
  // which used to leave them signed in with no users row and no visible error.
  it(
    "creates a user row with a null email when the account has no address",
    { timeout: 20000 },
    async () => {
      (globalThis as { __clerkEvent?: unknown }).__clerkEvent = {
        type: "user.created",
        data: {
          id: "user_oauth_1",
          email_addresses: [],
          first_name: "Grace",
          last_name: "Hopper",
        },
      };

      const res = await invoke();

      expect(res.status).toBe(200);
      expect(state.insert.values?.id).toBe("user_oauth_1");
      expect(state.insert.values?.email).toBeNull();
      // The row is inserted with a zero balance and topped up by grantCredits;
      // a null email must not cause the insert to be skipped.
      expect(state.insert.values?.credits).toBe(0);
    },
  );

  it(
    "still stores the address when the account has one",
    { timeout: 20000 },
    async () => {
      (globalThis as { __clerkEvent?: unknown }).__clerkEvent = {
        type: "user.created",
        data: {
          id: "user_email_1",
          email_addresses: [{ email_address: "a@b.com" }],
          first_name: "Ada",
        },
      };

      const res = await invoke();

      expect(res.status).toBe(200);
      expect(state.insert.values?.email).toBe("a@b.com");
    },
  );

  // The old default of 'example@gmail.com' plus a unique index meant the
  // second email-less signup hit Postgres 23505 and got a 500 from Clerk.
  // NULL is exempt from unique indexes, so both rows land. This asserts the
  // handler emits a distinct PK per event with no shared placeholder email —
  // the mock cannot enforce the index itself, but two distinct null values are
  // the precondition the constraint requires.
  it(
    "provisions every email-less account instead of colliding on a shared email",
    { timeout: 20000 },
    async () => {
      const seen: Record<string, unknown>[] = [];

      for (const id of ["user_oauth_1", "user_oauth_2"]) {
        (globalThis as { __clerkEvent?: unknown }).__clerkEvent = {
          type: "user.created",
          data: { id, email_addresses: [], first_name: "Grace" },
        };

        const res = await invoke();

        expect(res.status).toBe(200);
        seen.push({
          id: state.insert.values?.id,
          email: state.insert.values?.email,
        });
      }

      expect(seen.map((r) => r.id)).toEqual(["user_oauth_1", "user_oauth_2"]);
      // No row carries the old shared placeholder.
      expect(seen.every((r) => r.email === null)).toBe(true);
      expect(seen.some((r) => r.email === "example@gmail.com")).toBe(false);
    },
  );
});
