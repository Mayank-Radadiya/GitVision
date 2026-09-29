/**
 * T10 — a chat turn that fails or is aborted must not cost the caller a credit.
 *
 * The credit is spent before the model is called, so any failure after that
 * point (a provider error, a timeout, the user navigating away) silently took
 * the user's money and gave them nothing for it. The refund has to happen
 * exactly once: the AI SDK can report an aborted stream through both `onError`
 * and `onFinish`, and two refunds would be an infinite-money bug.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const calls: string[] = [];
const refunds: number[] = [];

/** Captured `streamText` options, so a test can invoke the onFinish hook. */
let streamTextOptions: { onFinish?: (e: unknown) => Promise<void> } = {};

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
            return chain([{ id: CHAT_ID, userId: "user_1" }]);
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
  enforceLimits: async () => ({ allowed: true, limit: 20, remaining: 19, scope: "user" }),
}));

vi.mock("@/src/lib/credits", () => ({
  CHAT_TURN_COST: 1,
  spendCredits: async () => {
    calls.push("spendCredits");
    return 42;
  },
  refundCredits: async (_userId: string, cost: number) => {
    calls.push("refundCredits");
    refunds.push(cost);
    return 43;
  },
}));

vi.mock("@/src/features/rag/services/embeddings", () => ({
  generateQueryEmbedding: async () => [],
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => () => ({}),
}));

vi.mock("ai", () => ({
  // Returns a well-formed result so the route reaches `onFinish`; the tests
  // drive the finish reason themselves.
  streamText: (options: typeof streamTextOptions) => {
    streamTextOptions = options;
    return { stream: {}, usage: {} };
  },
  generateText: () => ({}),
  createUIMessageStream: (opts: {
    onError?: (e: unknown) => unknown;
    execute: (ctx: { writer: { merge: () => void; write: () => void } }) => Promise<void>;
  }) => {
    // Run the producer eagerly with a no-op writer, capturing the stream error
    // handler so a test can report a provider failure.
    const handler = opts.onError;
    void opts
      .execute({
        writer: { merge: () => {}, write: () => {} },
      })
      .catch(() => undefined);
    return {
      pipe: () => ({}),
      onError: handler,
      __onError: handler,
    };
  },
  createUIMessageStreamResponse: (o: { stream: unknown }) => {
    const response = new Response("ok");
    response.headers.set("content-type", "text/event-stream");
    void o;
    return response;
  },
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
const CHAT_ID = VALID_UUID;

function post() {
  return POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "general",
        chatId: CHAT_ID,
        messages: [{ role: "user", content: "hello" }],
      }),
    }) as never,
  ) as Promise<Response>;
}

/** Completes the stream with the given finish reason. */
async function finishStream(finishReason: string, text = "partial") {
  await streamTextOptions.onFinish?.({ text, finishReason });
}

beforeEach(() => {
  calls.length = 0;
  refunds.length = 0;
  streamTextOptions = {};
});

describe("chat credit accounting", () => {
  it("spends a credit on a turn that completes normally", async () => {
    await post();
    await finishStream("stop");

    expect(calls).toContain("spendCredits");
    expect(refunds).toHaveLength(0);
  });

  it("refunds the credit when the stream errors", async () => {
    await post();
    await finishStream("error");

    expect(refunds).toEqual([1]);
  });

  it("refunds the credit when the stream is aborted", async () => {
    await post();
    await finishStream("aborted");

    expect(refunds).toEqual([1]);
  });

  it("refunds exactly once even if the failure is reported twice", async () => {
    await post();
    await finishStream("aborted");
    await finishStream("error");

    expect(refunds).toEqual([1]);
  });

  it("does not persist a truncated answer", async () => {
    await post();
    const before = calls.filter((c) => c === "insert").length;

    await finishStream("error", "half an ans");

    expect(calls.filter((c) => c === "insert").length).toBe(before);
  });
});
