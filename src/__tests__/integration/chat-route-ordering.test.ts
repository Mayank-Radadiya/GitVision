/**
 * Regression guard for the /api/chat side-effect ordering.
 *
 * The route used to INSERT the user message, then spend a credit, and only
 * afterwards discover the caller did not own the project — so an unauthorized
 * or out-of-credits request burned a credit and left an orphaned user turn.
 * This pins the invariant: authorization happens before ANY write or charge.
 *
 * The real `assertProjectOwnership` is used deliberately — the point of the
 * test is that the production guard rejects the request, not that a mock does.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Every side effect the route can perform lands here, in invocation order.
const calls: string[] = [];

/** Toggles whether the mocked project lookup returns an owned row. */
let projectIsOwned = true;

/** The title currently on the chat row, for the auto-rename cases. */
let chatTitle = "General Chat";

/**
 * The route's `streamText` `onFinish` callback, captured from the mock below.
 * The auto-rename lives inside it, and nothing in this file awaits it, so the
 * rename tests drive it directly instead of racing the mock.
 */
let onFinish:
  | ((result: { text: string; finishReason: string }) => Promise<void>)
  | undefined;

/** The stream's `execute`, captured from the `ai` mock. See `onFinish`. */
let executeStream:
  | ((ctx: { writer: unknown }) => Promise<void>)
  | undefined;

const WRITER = { write: () => {}, merge: () => {} };

const ownedProject = { id: "p1", ownerId: "user_1", projectName: "proj" };

// `project_chats.id` and `projects.id` are uuid columns, so the fixtures have
// to be real uuids for the request to get past /api/chat's schema validation
// and reach the ownership check this file is actually about.
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const CHAT_ID = "22222222-2222-4222-8222-222222222222";

/** Chainable no-op query builder. `limit`/`returning` resolve to `rows`. */
function chain(rows: unknown[] = []) {
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
    "onConflictDoNothing",
    "onConflictDoUpdate",
  ]) {
    builder[method] = () => builder;
  }
  return builder;
}

vi.mock("@/db", async () => {
  // Reference-compare the table passed to `.from()` so the chat-ownership
  // lookup and the project-ownership lookup can be controlled INDEPENDENTLY.
  // Returning the same result for both would let the chat check 404 first and
  // mask the very ordering regression this file exists to catch.
  const schema = await import("@/db/schema");

  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.projectChats) {
            // One row serves both the ownership lookup and the auto-rename's
            // title read, so the chat needs an owner AND a title.
            return chain([{ id: "chat_1", userId: "user_1", title: chatTitle }]);
          }
          if (table === schema.projectTables) {
            return chain(projectIsOwned ? [ownedProject] : []);
          }
          return chain([]);
        },
      }),
      insert: () => {
        calls.push("insert");
        return chain();
      },
      // `spendCredits`/`grantCredits` are single data-modifying CTEs, so the
      // credit write never touches `db.update` any more. The ordering marker
      // has to move here or the side-effect sequence reads as if no charge
      // happened at all.
      execute: async () => {
        calls.push("update:users");
        return { rows: [{ balance_after: 42 }] };
      },
      update: (table: unknown) => {
        if (table === schema.usersTable) {
          calls.push("update:users");
          return chain([{ credits: 42 }]);
        }
        // Two updates target the chat row — the `updatedAt` bump and the
        // auto-rename — so the payload, not the table, is what tells them
        // apart.
        const builder: Record<string, unknown> = {
          set: (values: Record<string, unknown>) => {
            calls.push("title" in values ? "rename-chat" : "touch-chat");
            return builder;
          },
        };
        builder.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve([]).then(resolve);
        for (const method of ["where", "limit", "from"]) {
          builder[method] = () => builder;
        }
        return builder;
      },
      delete: () => {
        calls.push("delete");
        return chain();
      },
    },
  };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_1" }),
}));

vi.mock("@/src/lib/rate-limit", () => ({
  // Real shape is { allowed, limit, remaining, scope } — returning
  // `allowed: true` is what lets the request past the 429 gate.
  enforceLimits: async () => ({ allowed: true, limit: 20, remaining: 19, scope: "user" }),
}));

// The provider must never be reached: these assertions are about what happens
// BEFORE the model call, so touching the model is itself a failure signal.
vi.mock("@/src/features/rag/services/embeddings", () => ({
  generateQueryEmbedding: async () => {
    calls.push("embeddings");
    return [];
  },
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => () => ({}),
}));

vi.mock("ai", () => ({
  streamText: (options: {
    onFinish?: (result: {
      text: string;
      finishReason: string;
    }) => Promise<void>;
  }) => {
    calls.push("streamText");
    // Captured, not invoked: the handler is only ever run by a test that
    // asks for it, so a rejected request still cannot reach the model.
    onFinish = options.onFinish;
    throw new Error("streamText must not run in these tests");
  },
  generateText: () => {
    calls.push("generateText");
    throw new Error("generateText must not run in these tests");
  },
  createUIMessageStream: (options: {
    execute?: (ctx: { writer: unknown }) => Promise<void>;
  }) => {
    // Captured, not invoked. The existing ordering tests want the request to
    // stop dead before the model, so nothing here calls `execute`; the
    // auto-rename tests drive it themselves.
    executeStream = options.execute;
    return { pipe: () => ({}), onError: () => ({}) };
  },
  createUIMessageStreamResponse: () => ({}),
  toUIMessageStream: () => ({}),
}));

vi.mock("@/src/features/rag/services/vector-search", () => ({
  searchSimilarCode: async () => [],
  searchSimilarCodeInFile: async () => [],
  formatRetrievedContext: () => "",
  getProjectContext: async () => ({ context: "", relatedFiles: [] }),
  reRankResults: () => [],
  isSmallProject: () => false,
  getAllProjectFilesForContext: async () => [],
}));

vi.mock("@/src/features/rag/services/rag/query-classifier", () => ({
  classifyQuery: () => "general",
}));

vi.mock("@/src/features/rag/services/rag/context-fetcher", () => ({
  fetchContext: async () => ({ context: "", relatedFiles: [] }),
}));

vi.mock("@/src/shared/lib/chat-history", () => ({
  getRecentChatHistoryForContext: async () => [],
}));

import { POST } from "@/app/api/chat/route";

function postChat() {
  return POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "project",
        projectId: PROJECT_ID,
        chatId: CHAT_ID,
        message: "hello",
        messages: [{ role: "user", content: "hello" }],
      }),
    }) as never,
  ) as Promise<Response>;
}

beforeEach(() => {
  calls.length = 0;
  projectIsOwned = true;
  chatTitle = "General Chat";
  onFinish = undefined;
  executeStream = undefined;
});

describe("/api/chat side-effect ordering", () => {
  it("returns 404 without writing or charging when the caller does not own the project", async () => {
    projectIsOwned = false;

    const response = await postChat();

    // ProjectAccessError is converted to a 404 by the route's outer catch.
    expect(response.status).toBe(404);
    // The regression: these two used to happen BEFORE the ownership check.
    expect(calls).not.toContain("insert");
    expect(calls).not.toContain("update:users");
  });

  it("does not reach the model or the embedding provider on a rejected request", async () => {
    projectIsOwned = false;

    await postChat();

    expect(calls).not.toContain("streamText");
    expect(calls).not.toContain("generateText");
    expect(calls).not.toContain("embeddings");
  });

  it("still writes the user message and spends a credit on an authorized request", async () => {
    projectIsOwned = true;

    await postChat();

    // The happy path is intact after the reordering: the user message is
    // persisted and a credit is spent. (The request then dies in the mocked
    // model layer, which is out of scope here — the assertion is that both
    // writes are reachable only after authorization cleared.)
    expect(calls).toEqual(["insert", "update:users"]);
  });
});

/**
 * T-048 — the auto-rename must only ever overwrite a placeholder the app
 * itself inserted. It used to treat "New Chat" as a sentinel too, so a user
 * who deliberately named their chat "New Chat" lost that name on their first
 * turn. `chat.create` only ever writes "General Chat" or "Project Chat" when
 * the caller supplies no title; "New Chat" is a column default no insert path
 * uses, so matching it bought nothing and cost a real title.
 */
describe("/api/chat auto-rename", () => {
  /** Run one completed turn and return what the route did to the chat row. */
  async function completeTurn(finishReason = "stop") {
    await postChat();
    expect(executeStream).toBeTypeOf("function");
    // The mocked model layer throws by design; the rename happens in the
    // `onFinish` the route handed it, so the throw is expected, not a failure.
    await executeStream!({ writer: WRITER }).catch(() => undefined);
    expect(onFinish).toBeTypeOf("function");
    calls.length = 0;
    await onFinish!({ text: "an answer", finishReason });
    return calls;
  }

  it("names a freshly created general chat from the first message", async () => {
    chatTitle = "General Chat";

    expect(await completeTurn()).toContain("rename-chat");
  });

  it("names a freshly created project chat from the first message", async () => {
    chatTitle = "Project Chat";

    expect(await completeTurn()).toContain("rename-chat");
  });

  it("leaves a title the user chose alone", async () => {
    chatTitle = "Refactoring the auth middleware";

    expect(await completeTurn()).not.toContain("rename-chat");
  });

  it("leaves a chat the user deliberately named \"New Chat\" alone", async () => {
    chatTitle = "New Chat";

    expect(await completeTurn()).not.toContain("rename-chat");
  });

  it("does not rename a turn that ended in an error", async () => {
    chatTitle = "General Chat";

    expect(await completeTurn("error")).not.toContain("rename-chat");
  });
});
