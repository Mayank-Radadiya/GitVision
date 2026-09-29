/**
 * `chat.delete` filtered on `id` AND `userId` and then returned
 * `{ success: true }` whether or not anything matched. Every one of the three
 * outcomes — the chat was yours and is gone, it exists but belongs to somebody
 * else, it never existed — reached the caller as the same success, so a UI
 * could not drop the row it had just optimistically removed from the list.
 *
 * The fix adds `.returning()` and reports the row count. It deliberately does
 * NOT separate "not yours" from "not there": both are a single `deleted:
 * false`, because a response that distinguishes them is an existence oracle —
 * a caller could enumerate chat ids and learn which ones are real.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const CHAT_ID = "22222222-2222-4222-8222-222222222222";

/** Rows `.returning()` resolves to — one for a real delete, none for a miss. */
let deleteResult: { id: string }[] = [];
/** Whether the procedure asked for the deleted rows back at all. */
let returningCalls = 0;

vi.mock("@/db", () => ({
  db: {
    delete: () => {
      const chain: Record<string, unknown> = {
        where: () => chain,
        returning: () => {
          returningCalls += 1;
          const rows = deleteResult;
          return {
            then: (
              resolve: (v: unknown) => unknown,
              reject: (e: unknown) => unknown,
            ) => Promise.resolve(rows).then(resolve, reject),
          };
        },
      };
      return chain;
    },
  },
}));

vi.mock("@/src/lib/guards", () => ({
  assertProjectOwnership: vi.fn(),
}));

import { createCallerFactory } from "@/src/lib/trpc/init";
import { chatRouter } from "@/features/chat/server/router/chat";

const caller = createCallerFactory(chatRouter)({
  userId: "user_1",
  req: undefined,
  requestId: "test-request",
});

beforeEach(() => {
  deleteResult = [];
  returningCalls = 0;
});

describe("chat.delete reports what it actually did", () => {
  it("reports a deleted row", async () => {
    deleteResult = [{ id: CHAT_ID }];

    await expect(caller.delete({ chatId: CHAT_ID })).resolves.toEqual({
      success: true,
      deleted: true,
    });
  });

  it("asks Postgres for the deleted rows, so the count is real", async () => {
    // Without `.returning()` there is nothing to count and `deleted` would be
    // a guess — which is the bug being fixed.
    await caller.delete({ chatId: CHAT_ID });

    expect(returningCalls).toBe(1);
  });

  it("reports a miss instead of claiming success", async () => {
    await expect(caller.delete({ chatId: CHAT_ID })).resolves.toEqual({
      success: true,
      deleted: false,
    });
  });

  it("keeps 'not yours' and 'not there' indistinguishable", async () => {
    // Both are the same zero-row DELETE — the `userId` predicate is part of
    // the same WHERE, so the database cannot tell the caller which happened
    // either. The response must not reintroduce the distinction.
    await expect(caller.delete({ chatId: CHAT_ID })).resolves.toEqual({
      success: true,
      deleted: false,
    });
  });

  it("never throws for a chat the caller does not own", async () => {
    await expect(
      caller.delete({ chatId: "33333333-3333-4333-8333-333333333333" }),
    ).resolves.toEqual({ success: true, deleted: false });
  });
});
