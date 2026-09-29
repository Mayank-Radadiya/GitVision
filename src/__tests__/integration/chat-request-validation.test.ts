/**
 * T7/T8 — the request body must be validated before it is used.
 *
 * The route destructured `req.json()` straight into variables and only checked
 * that `messages` was a non-empty array. A non-UUID `chatId` reached the
 * ownership query, and an arbitrarily long `messages` array was accepted and
 * forwarded to the model — so bad input surfaced as a 500 rather than a 400,
 * and a caller could hand the endpoint an unbounded prompt.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const calls: string[] = [];

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
  ]) {
    builder[method] = () => builder;
  }
  return builder;
}

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.projectChats) {
            return chain([{ id: "chat_1", userId: "user_1" }]);
          }
          if (table === schema.projectTables) {
            return chain([{ id: "p1", ownerId: "user_1", projectName: "p" }]);
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
    },
  };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_1" }),
}));

vi.mock("@/src/lib/rate-limit", () => ({
  rateLimit: async () => ({ allowed: true, limit: 20, remaining: 19 }),
  keys: new Proxy({}, { get: () => () => "test-key" }),
}));

vi.mock("@/src/features/rag/services/embeddings", () => ({
  generateQueryEmbedding: async () => [],
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

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

/** `overrides` replaces or adds top-level body fields. */
function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  ) as Promise<Response>;
}

const VALID = {
  mode: "general",
  chatId: VALID_UUID,
  messages: [{ role: "user", content: "hello" }],
};

beforeEach(() => {
  calls.length = 0;
});

describe("POST /api/chat request validation", () => {
  // T7 — a malformed identifier must be a client error, not a 500.
  it("returns 400 for a non-UUID chatId", async () => {
    const response = await post({ ...VALID, chatId: "not-a-uuid" });

    expect(response.status).toBe(400);
  });

  it("returns 400 for a non-UUID projectId", async () => {
    const response = await post({
      ...VALID,
      mode: "project",
      projectId: "nope",
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 rather than 500 for a malformed body", async () => {
    const response = await post({ ...VALID, messages: "not-an-array" });

    expect(response.status).toBe(400);
  });

  // T8 — the message array must be bounded, or the endpoint is an unbounded
  // prompt-injection and cost surface.
  it("rejects a messages array over the message-count cap", async () => {
    const messages = Array.from({ length: 200 }, (_, i) => ({
      role: "user",
      content: `message ${i}`,
    }));

    const response = await post({ ...VALID, messages });

    expect(response.status).toBe(400);
  });

  it("rejects a single message over the per-message size cap", async () => {
    const response = await post({
      ...VALID,
      messages: [{ role: "user", content: "x".repeat(200_000) }],
    });

    expect(response.status).toBe(400);
  });

  it("rejects a body whose total input exceeds the budget", async () => {
    const messages = Array.from({ length: 50 }, () => ({
      role: "user",
      content: "x".repeat(9_000),
    }));

    const response = await post({ ...VALID, messages });

    expect(response.status).toBe(400);
  });

  it("does not touch the database on a rejected body", async () => {
    await post({ ...VALID, chatId: "not-a-uuid" });

    expect(calls).not.toContain("insert");
    expect(calls).not.toContain("update:users");
  });

  it("accepts a well-formed general-mode body", async () => {
    const response = await post(VALID);

    expect(response.status).not.toBe(400);
  });

  it("accepts a well-formed project-mode body", async () => {
    const response = await post({
      ...VALID,
      mode: "project",
      projectId: VALID_UUID,
    });

    expect(response.status).not.toBe(400);
  });
});
