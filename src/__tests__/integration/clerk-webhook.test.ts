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
    return thenable;
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
  it("upserts on the primary key so an existing user is updated in place", async () => {
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
    const target = state.insert.conflict?.target as { name: string } | undefined;
    expect(target?.name).toBe("id");
  }, { timeout: 20000 });

  it("does not hand out credits on an update, only on insert", async () => {
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
  }, { timeout: 20000 });

  it("returns 500 when the database write fails so Clerk retries", async () => {
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
  }, { timeout: 20000 });

  it("still returns 200 for events it does not handle", async () => {
    (globalThis as { __clerkEvent?: unknown }).__clerkEvent = {
      type: "session.created",
      data: { id: "sess_1" },
    };

    const res = await invoke();
    expect(res.status).toBe(200);
  }, { timeout: 20000 });
});

