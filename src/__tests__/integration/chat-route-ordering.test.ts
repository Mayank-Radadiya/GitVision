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
            return chain([{ id: "chat_1", userId: "user_1" }]);
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
      update: () => {
        calls.push("update:users");
        return chain([{ credits: 42 }]);
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
  // Real shape is { allowed, limit, remaining } — returning `allowed: true`
  // is what lets the request past the 429 gate.
  rateLimit: async () => ({ allowed: true, limit: 20, remaining: 19 }),
  keys: new Proxy({}, { get: () => () => "test-key" }),
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
  streamText: () => {
    calls.push("streamText");
    throw new Error("streamText must not run in these tests");
  },
  generateText: () => {
    calls.push("generateText");
    throw new Error("generateText must not run in these tests");
  },
  createUIMessageStream: () => ({ pipe: () => ({}), onError: () => ({}) }),
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
