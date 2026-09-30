/**
 * The chat page used to call `chat.getById` and then run its own query for the
 * project name, so every chat page load hit the database twice for data it
 * already had the join key for. This pins the single LEFT JOIN: the procedure
 * now returns the name, and the fake below only produces it if the join
 * actually happened.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const CHAT_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

let leftJoins = 0;
// Lives out here so `beforeEach` can reset it: the factory below is hoisted, so
// a counter declared inside it survives across every test in this file. Without
// the reset, the second test starts on an even select and reads an empty result.
let selects = 0;

const chatRow = {
  id: CHAT_ID,
  userId: "user_1",
  type: "project",
  title: "About the auth flow",
  projectId: PROJECT_ID,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function makeRows(getRows: () => unknown[]) {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    leftJoin: () => {
      leftJoins += 1;
      return chain;
    },
    limit: () => chain,
    // Resolved on await, so a join added after select() still counts.
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(getRows()).then(resolve, reject),
  };
  return chain;
}

vi.mock("@/db", () => {
  return {
    db: {
      select: () => {
        selects += 1;
        // The first select in the procedure is the joined chat row; every
        // later select fetches something the chat already implies. Only a
        // joined query can produce the project name.
        return makeRows(() =>
          selects % 2 === 1
            ? leftJoins > 0
              ? [{ ...chatRow, projectName: "acme/demo" }]
              : [chatRow]
            : [],
        );
      },
    },
  };
});

vi.mock("@/src/lib/guards", () => ({
  assertProjectOwnership: vi.fn(),
}));

import { createCallerFactory } from "@/src/lib/trpc/init";
import { chatRouter } from "@/src/features/chat/server/router/chat";

const caller = createCallerFactory(chatRouter)({
  userId: "user_1",
  req: undefined,
  requestId: "test-request",
});

beforeEach(() => {
  leftJoins = 0;
  selects = 0;
});

describe("chat.getById", () => {
  it("brings the project name back with the chat", async () => {
    const chat = await caller.getById({ chatId: CHAT_ID });

    expect(leftJoins).toBe(1);
    expect(chat.projectName).toBe("acme/demo");
  });

  it("still returns the chat itself", async () => {
    const chat = await caller.getById({ chatId: CHAT_ID });

    expect(chat.id).toBe(CHAT_ID);
    expect(chat.title).toBe("About the auth flow");
    expect(chat.projectId).toBe(PROJECT_ID);
  });
});
