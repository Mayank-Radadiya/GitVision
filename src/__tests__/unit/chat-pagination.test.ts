import { describe, it, expect, beforeEach, vi } from "vitest";

const CHAT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user_1";

/** Records the chain calls each query makes so we can assert the pagination contract. */
const calls: {
  from: unknown;
  limit: number | undefined;
  where: unknown;
  orderBy: unknown;
  innerSelect: { fields: unknown; table: unknown } | undefined;
}[] = [];

function makeRows(rows: unknown[]) {
  const promise = Promise.resolve(rows);
  const chain: Record<string, unknown> = {
    from: (table: unknown) => {
      calls.push({
        from: table,
        limit: undefined,
        where: undefined,
        orderBy: undefined,
        innerSelect: undefined,
      });
      return chain;
    },
    where: (cond: unknown) => {
      calls[calls.length - 1].where = cond;
      return chain;
    },
    orderBy: (clause: unknown) => {
      calls[calls.length - 1].orderBy = clause;
      return chain;
    },
    // getById LEFT JOINs the projects table to return the project name.
    leftJoin: () => chain,
    limit: (n: number) => {
      calls[calls.length - 1].limit = n;
      return promise;
    },
    // getById issues a narrow-column select for the messages query
    select: (fields?: unknown) => {
      const next: Record<string, unknown> = {
        ...chain,
        from: (table: unknown) => {
          calls.push({
            from: table,
            limit: undefined,
            where: undefined,
            orderBy: undefined,
            innerSelect:
              fields === undefined ? undefined : { fields, table: undefined },
          });
          return next;
        },
      };
      return next;
    },
  };
  return chain;
}

vi.mock("@/db", () => {
  let query = 0;
  const chatRow = {
    id: "22222222-2222-4222-8222-222222222222",
    userId: "user_1",
    type: "general",
    title: "General Chat",
    projectId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  return {
    db: {
      select: (...args: unknown[]) => {
        void args;
        // 1st select() in a procedure is the chat row, the next is messages.
        query += 1;
        return makeRows(query % 2 === 1 ? [chatRow] : []);
      },
      __reset: () => {
        query = 0;
      },
    },
  };
});

vi.mock("@/src/lib/guards", () => ({
  assertProjectOwnership: vi.fn(),
}));

import { createCallerFactory } from "@/src/lib/trpc/init";
import { chatRouter } from "@/src/features/chat/server/router/chat";

const createCaller = createCallerFactory(chatRouter);
const caller = createCaller({ userId: USER_ID, req: undefined } as never);

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: CHAT_ID,
    userId: USER_ID,
    type: "general",
    title: "General Chat",
    projectId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(async () => {
  calls.length = 0;
  const { db } = await import("@/db");
  (db as unknown as { __reset: () => void }).__reset();
});

describe("chat.getAll pagination", () => {
  it("returns an object with items and nextCursor, not a bare array", async () => {
    const result = await caller.getAll();

    expect(Array.isArray(result)).toBe(false);
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("nextCursor");
  });

  it("applies a LIMIT by default", async () => {
    await caller.getAll();

    const select = calls[0];
    expect(select.limit).toBeDefined();
    expect(select.limit).toBeGreaterThan(0);
  });

  it("applies the caller's limit, plus one sentinel row to detect a next page", async () => {
    await caller.getAll({ limit: 5 });

    expect(calls[0].limit).toBe(6);
  });

  it("rejects a limit above the maximum instead of silently clamping", async () => {
    await expect(caller.getAll({ limit: 1000 })).rejects.toThrow();
  });

  it("rejects a non-numeric limit", async () => {
    await expect(
      caller.getAll({ limit: "all" as unknown as number }),
    ).rejects.toThrow();
  });

  it("sets nextCursor when a further page exists", async () => {
    const db = (await import("@/db")).db;
    // limit 2 => we ask for 3; getting 3 back proves a second page exists.
    const spy = vi
      .spyOn(db, "select")
      .mockReturnValue(makeRows([row(), row(), row()]) as never);

    const result = await caller.getAll({ limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
    spy.mockRestore();
  });

  it("leaves nextCursor null on a partial page", async () => {
    const db = (await import("@/db")).db;
    const spy = vi
      .spyOn(db, "select")
      .mockReturnValue(makeRows([row()]) as never);

    const result = await caller.getAll({ limit: 30 });

    expect(result.nextCursor).toBeNull();
    spy.mockRestore();
  });
});

describe("chat.getById message pagination", () => {
  it("reports hasMoreMessages alongside the messages", async () => {
    const chat = await caller.getById({ chatId: CHAT_ID });

    expect(chat).toHaveProperty("hasMoreMessages");
  });

  it("bounds the messages query", async () => {
    await caller.getById({ chatId: CHAT_ID });

    const messageQuery = calls[1];
    expect(messageQuery.limit).toBeDefined();
    expect(messageQuery.limit).toBeGreaterThan(0);
  });

  it("applies the caller's messageLimit, plus one sentinel row", async () => {
    await caller.getById({ chatId: CHAT_ID, messageLimit: 5 });

    expect(calls[1].limit).toBe(6);
  });

  it("returns messages oldest-first even though it fetches newest-first", async () => {
    const db = (await import("@/db")).db;
    const spy = vi.spyOn(db, "select");

    // The 1st select() is the chat row, the 2nd is the message page.
    let n = 0;
    spy.mockImplementation((() => {
      n += 1;
      return n === 1
        ? makeRows([row()] as never)
        : makeRows([
            { id: "m3", createdAt: new Date("2026-01-03") },
            { id: "m2", createdAt: new Date("2026-01-02") },
            { id: "m1", createdAt: new Date("2026-01-01") },
          ] as never);
    }) as never);

    const result = await caller.getById({ chatId: CHAT_ID, messageLimit: 10 });

    expect(result.messages.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    spy.mockRestore();
  });

  it("rejects a messageLimit above the maximum", async () => {
    await expect(
      caller.getById({ chatId: CHAT_ID, messageLimit: 100_000 }),
    ).rejects.toThrow();
  });
});
