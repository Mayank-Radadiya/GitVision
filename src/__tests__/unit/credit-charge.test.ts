import { describe, it, expect, vi, beforeEach } from "vitest";

const logged: string[] = [];
vi.mock("@/src/lib/logger", () => ({
  logger: {
    warn: () => undefined,
    info: () => undefined,
    error: (message: string) => logged.push(message),
    debug: () => undefined,
  },
}));

type Statement = { sql: string; values: unknown[]; isGrant: boolean };

const state = {
  statements: [] as Statement[],
  /** Rows the fake returns; `balance_after` drives whether a charge succeeded. */
  rows: [{ balance_after: 42 }] as Record<string, unknown>[],
  failSpend: false,
  failGrant: false,
};

/**
 * Flattens a Drizzle `sql` template to its text and the values spliced into it.
 *
 * Four chunk shapes have to be told apart, and they are not distinguishable by
 * `value !== undefined`:
 *
 * - `StringChunk` — literal text, `value: string[]`.
 * - A bare `String` / `Number` / `Boolean` — the compiled template splices
 *   primitive interpolations straight into the statement, so an inlined string
 *   and a bound parameter look alike until you check the constructor.
 * - `Param` — a non-primitive interpolation, such as the `null` an unkeyed
 *   movement passes.
 * - A nested `SQL` — a fragment interpolated whole.
 */
function readQuery(query: unknown): { sql: string; values: unknown[] } {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) {
    return { sql: String(query), values: [] };
  }
  const sql: string[] = [];
  const values: unknown[] = [];
  for (const chunk of chunks) {
    if (chunk === null || chunk === undefined) {
      sql.push("");
      continue;
    }
    const { value, name } = chunk as {
      value?: unknown;
      name?: string;
      queryChunks?: unknown[];
    };
    if (Array.isArray(value)) {
      sql.push(value.join(""));
    } else if (Array.isArray((chunk as { queryChunks?: unknown[] }).queryChunks)) {
      const nested = readQuery(chunk);
      sql.push(nested.sql);
      values.push(...nested.values);
    } else if (value !== undefined) {
      sql.push("?");
      values.push(value);
    } else if (
      typeof chunk === "string" ||
      typeof chunk === "number" ||
      typeof chunk === "boolean"
    ) {
      sql.push(String(chunk));
      values.push(chunk);
    } else if (typeof name === "string") {
      sql.push(name);
    } else {
      sql.push("");
    }
  }
  return { sql: sql.join(" "), values };
}

vi.mock("@/db", () => ({
  db: {
    execute: async (query: unknown) => {
      const { sql, values } = readQuery(query);
      // `grantCredits` adds and `spendCredits` subtracts; that is the only thing
      // distinguishing the two statements, so it is what the fake keys on.
      const isGrant = sql.includes("users.credits +");
      state.statements.push({ sql, values, isGrant });
      if (isGrant ? state.failGrant : state.failSpend) {
        throw new Error("db unavailable");
      }
      return { rows: state.rows };
    },
  },
}));

import { openCharge } from "@/src/lib/credits";

const USER = "user_1";

beforeEach(() => {
  state.statements = [];
  state.rows = [{ balance_after: 42 }];
  state.failSpend = false;
  state.failGrant = false;
  logged.length = 0;
});

/** Statements that move credits back to the user. */
function grants(): Statement[] {
  return state.statements.filter((s) => s.isGrant);
}

/** Statements that take credits away. */
function charges(): Statement[] {
  return state.statements.filter((s) => !s.isGrant);
}

/**
 * The `ref_id` a statement carries, if any.
 *
 * `ref_id` is the only place a per-charge idempotency key can live, and a keyed
 * movement's key is recognisable by its shape rather than by position — which is
 * also what makes "the charge carried no key" assertable at all.
 */
function refIdOf(statement: Statement): unknown {
  return statement.values.find(
    (v) => typeof v === "string" && v.endsWith(":refund"),
  );
}

describe("openCharge", () => {
  it("charges the cost it was given, for the reason it was given", async () => {
    const charge = await openCharge(USER, 7, "commit_summary");

    expect(charge).not.toBeNull();
    expect(charges()).toHaveLength(1);
    expect(charges()[0].values).toContain(7);
    expect(charges()[0].sql).toContain("commit_summary");
  });

  it("reports an unaffordable charge as null without issuing a refund", async () => {
    // A guarded UPDATE matching no rows is how "cannot afford" arrives: no
    // rows, not an error.
    state.rows = [];

    const charge = await openCharge(USER, 1, "chat_turn");

    expect(charge).toBeNull();
    expect(grants()).toHaveLength(0);
  });

  it("leaves the charge unkeyed so a repeated turn is charged again", async () => {
    await openCharge(USER, 1, "chat_turn");
    await openCharge(USER, 1, "chat_turn");

    expect(charges()).toHaveLength(2);
    expect(refIdOf(charges()[0])).toBeUndefined();
    expect(refIdOf(charges()[1])).toBeUndefined();
  });
});

describe("Charge.refund", () => {
  it("credits the charge back exactly once, however many times it is called", async () => {
    const charge = await openCharge(USER, 1, "chat_turn");
    if (!charge) throw new Error("expected an open charge");

    await charge.refund();
    await charge.refund();
    await charge.refund();

    expect(grants()).toHaveLength(1);
  });

  it("issues one credit when three failures are reported at once", async () => {
    const charge = await openCharge(USER, 1, "chat_turn");
    if (!charge) throw new Error("expected an open charge");

    // The abort-once case is a *race*, not a sequence: the SDK can report an
    // abort through several channels before the first await resolves.
    await Promise.all([
      charge.refund(),
      charge.refund(),
      charge.refund(),
    ]);

    expect(grants()).toHaveLength(1);
  });

  it("short-circuits the later calls instead of relying on the ledger key", async () => {
    const charge = await openCharge(USER, 1, "chat_turn");
    if (!charge) throw new Error("expected an open charge");

    await charge.refund();
    await charge.refund();

    // A second statement carrying the same key *would* be swallowed by
    // ON CONFLICT, so this asserts the cheaper guarantee as well: no round-trip.
    expect(grants()).toHaveLength(1);
  });

  it("does not credit a settled charge", async () => {
    const charge = await openCharge(USER, 1, "chat_turn");
    if (!charge) throw new Error("expected an open charge");

    charge.settle();
    await charge.refund();

    expect(grants()).toHaveLength(0);
  });

  it("keeps the credit when a settled charge is refunded after the fact", async () => {
    // The case the in-process latch could not handle: the stream reports
    // completion, then reports the abort.
    const charge = await openCharge(USER, 1, "chat_turn");
    if (!charge) throw new Error("expected an open charge");

    charge.settle();
    charge.settle();
    await charge.refund();

    expect(grants()).toHaveLength(0);
    expect(charges()).toHaveLength(1);
  });

  it("refunds even if the charge was settled after the refund was requested", async () => {
    const charge = await openCharge(USER, 1, "chat_turn");
    if (!charge) throw new Error("expected an open charge");

    const pending = charge.refund();
    charge.settle();
    await pending;

    expect(grants()).toHaveLength(1);
  });

  it("never rejects when the refund itself fails, and logs instead", async () => {
    const charge = await openCharge(USER, 4, "project_creation");
    if (!charge) throw new Error("expected an open charge");
    state.failGrant = true;

    await expect(charge.refund()).resolves.toBeUndefined();

    expect(grants()).toHaveLength(1);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("project_creation");
  });

  it("still refuses a second refund after the first one failed", async () => {
    // The failure is logged, but the attempt still counts: re-issuing it on a
    // later signal would risk a second credit for a refund already recorded.
    const charge = await openCharge(USER, 4, "project_creation");
    if (!charge) throw new Error("expected an open charge");
    state.failGrant = true;

    await charge.refund();
    await charge.refund();

    expect(grants()).toHaveLength(1);
  });
});

describe("Charge refund idempotency key", () => {
  it("keys the refund and not the charge", async () => {
    // If both legs shared a key the refund would collide with its own charge
    // and never be issued, so this is the property that makes keying safe.
    const charge = await openCharge(USER, 1, "chat_turn");
    if (!charge) throw new Error("expected an open charge");
    await charge.refund();

    expect(refIdOf(charges()[0])).toBeUndefined();
    expect(refIdOf(grants()[0])).toMatch(/^chat_turn:.+:refund$/);
  });

  it("mints one key for a charge, not one per attempt", async () => {
    // The in-process guard means a second attempt issues no statement at all,
    // so this cannot observe two attempts sharing a key directly. What it can
    // observe is the property that produces the sharing: the key is derived
    // once when the charge opens and is held, rather than minted inside
    // `refund()` where each call would get a fresh one — which is precisely
    // what would let a retry after an eviction credit the user twice.
    const charge = await openCharge(USER, 1, "chat_turn");
    if (!charge) throw new Error("expected an open charge");

    state.failGrant = true;
    await charge.refund();
    await charge.refund();
    await charge.refund();

    expect(grants()).toHaveLength(1);
    expect(refIdOf(grants()[0])).toMatch(/^chat_turn:.+:refund$/);
  });

  it("gives two separate charges two separate keys", async () => {
    const first = await openCharge(USER, 1, "chat_turn");
    const second = await openCharge(USER, 1, "chat_turn");
    if (!first || !second) throw new Error("expected two open charges");

    await first.refund();
    await second.refund();

    expect(refIdOf(grants()[0])).not.toBe(refIdOf(grants()[1]));
  });

  it("scopes the key to the reason, so ledger rows stay attributable", async () => {
    const chat = await openCharge(USER, 1, "chat_turn");
    const summary = await openCharge(USER, 1, "commit_summary");
    if (!chat || !summary) throw new Error("expected two open charges");

    await chat.refund();
    await summary.refund();

    expect(refIdOf(grants()[0])).toMatch(/^chat_turn:/);
    expect(refIdOf(grants()[1])).toMatch(/^commit_summary:/);
  });

  it("guards the balance update, because ON CONFLICT does not", async () => {
    // `ON CONFLICT (ref_id) DO NOTHING` suppresses the ledger row only. The
    // balance change is a sibling data-modifying CTE that has already run, so
    // without this predicate a replayed refund credits the user twice and writes
    // one row. This asserts the statement, since the behaviour is the database's.
    const charge = await openCharge(USER, 1, "chat_turn");
    if (!charge) throw new Error("expected an open charge");
    await charge.refund();

    expect(grants()[0].sql).toMatch(
      /NOT EXISTS \(\s*SELECT 1 FROM credit_transactions WHERE ref_id/i,
    );
    // And it has to be inside the UPDATE, not tacked onto the INSERT.
    const update = grants()[0].sql.indexOf("UPDATE users");
    expect(update).toBeGreaterThan(-1);
    expect(update).toBeLessThan(grants()[0].sql.indexOf("INSERT INTO"));
  });

  it("leaves an unkeyed movement without the guard", async () => {
    // The charge leg is deliberately unkeyed, so it must not pay for a ledger
    // lookup it does not need — and an unkeyed statement stays byte-identical to
    // the one that shipped before this module existed.
    const charge = await openCharge(USER, 1, "chat_turn");
    if (!charge) throw new Error("expected an open charge");

    expect(charges()[0].sql).not.toMatch(/NOT EXISTS/i);
  });
});