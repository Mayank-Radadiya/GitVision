/**
 * `chat.create` and `chat.getById` threw bare `Error`s, which tRPC maps to
 * INTERNAL_SERVER_ERROR — the one code the error formatter masks in production.
 * So a missing projectId and a chat that does not exist both reached the user
 * as the same opaque "An error occurred", with no stack and no status that
 * distinguishes a bad request from a broken server.
 *
 * These pin the two codes the procedures should have been throwing all along.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const CHAT_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

/** Rows the two select chains resolve to, keyed by call order. */
let selectResults: unknown[][] = [];
/** How many select chains the procedure built — shift() hides this. */
let selectCalls = 0;

function makeRows(getRows: () => unknown[]) {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    leftJoin: () => chain,
    limit: () => chain,
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(getRows()).then(resolve, reject),
  };
  return chain;
}

vi.mock("@/db", () => ({
  db: {
    select: () => {
      selectCalls += 1;
      const rows = selectResults.shift() ?? [];
      return makeRows(() => rows);
    },
    // Echo the inserted values back with an id, the way Postgres would, so a
    // test can assert on the row the procedure actually built.
    insert: () => {
      let values: Record<string, unknown> = {};
      const chain: Record<string, unknown> = {
        values: (v: Record<string, unknown>) => {
          values = v;
          return chain;
        },
        returning: () =>
          Promise.resolve([
            {
              id: CHAT_ID,
              ...values,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          ]),
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
  selectResults = [];
  selectCalls = 0;
});

describe("chat.create input errors", () => {
  it("reports a missing projectId as BAD_REQUEST, not a server error", async () => {
    await expect(
      caller.create({ type: "project" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Project ID required for project chats",
    });
  });

  it("still creates a general chat with no projectId", async () => {
    const chat = await caller.create({ type: "general" });

    expect(chat.id).toBe(CHAT_ID);
    expect(chat.title).toBe("General Chat");
    expect(chat.projectId).toBeNull();
  });
});

describe("chat.getById missing chat", () => {
  it("reports an unknown chatId as NOT_FOUND", async () => {
    // The first select is the chat row; an empty result is "no such chat".
    selectResults = [[], []];

    await expect(caller.getById({ chatId: CHAT_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Chat not found",
    });
  });

  it("does not query messages once the chat is known to be missing", async () => {
    selectResults = [[]];

    await expect(caller.getById({ chatId: CHAT_ID })).rejects.toBeInstanceOf(
      TRPCError,
    );

    expect(selectCalls).toBe(1);
  });
});
