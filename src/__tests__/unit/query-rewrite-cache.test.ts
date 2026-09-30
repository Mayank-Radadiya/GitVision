/**
 * A retried or resumed request replays the same (chat, query) pair, and every
 * cache miss is a billable round-trip to Gemini. These pin that the rewrite is
 * served from memory on a repeat, that a different chat is never served another
 * chat's answer, and that a failure is not cached.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { generateText } = vi.hoisted(() => ({
  generateText: vi.fn(async () => ({ text: "  rewritten query  " })),
}));

vi.mock("ai", () => ({ generateText }));
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => (model: string) => model,
}));

import {
  rewriteQueryForRetrieval,
  clearRewriteCache,
} from "@/src/lib/llm/query-rewrite";

const HISTORY = "user: where is auth handled\nassistant: src/lib/auth.ts";

beforeEach(() => {
  generateText.mockClear();
  generateText.mockResolvedValue({ text: "  rewritten query  " } as never);
  clearRewriteCache();
});

describe("rewriteQueryForRetrieval", () => {
  it("returns the trimmed rewrite", async () => {
    const result = await rewriteQueryForRetrieval("q", HISTORY, "chat-1");
    expect(result).toBe("rewritten query");
  });

  it("serves a repeated chat + query from cache", async () => {
    await rewriteQueryForRetrieval("q", HISTORY, "chat-1");
    await rewriteQueryForRetrieval("q", HISTORY, "chat-1");
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("does not leak one chat's rewrite to another chat", async () => {
    await rewriteQueryForRetrieval("q", HISTORY, "chat-1");
    await rewriteQueryForRetrieval("q", HISTORY, "chat-2");
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("does not leak a rewrite across different histories", async () => {
    await rewriteQueryForRetrieval("q", HISTORY, "chat-1");
    await rewriteQueryForRetrieval(
      "q",
      `${HISTORY}\nuser: and sessions`,
      "chat-1",
    );
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("treats surrounding whitespace in the query as the same query", async () => {
    await rewriteQueryForRetrieval("q", HISTORY, "chat-1");
    await rewriteQueryForRetrieval("  q  ", HISTORY, "chat-1");
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("skips the model entirely when there is no real history", async () => {
    const result = await rewriteQueryForRetrieval(
      "q",
      "No previous conversation.",
      "chat-1",
    );
    expect(result).toBe("q");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("falls back to the raw message when the call throws", async () => {
    generateText.mockRejectedValue(new Error("rate limited") as never);
    const result = await rewriteQueryForRetrieval("q", HISTORY, "chat-1");
    expect(result).toBe("q");
  });

  it("does not cache a failure", async () => {
    generateText.mockRejectedValue(new Error("rate limited") as never);
    await rewriteQueryForRetrieval("q", HISTORY, "chat-1");
    generateText.mockResolvedValue({ text: "recovered" } as never);
    const result = await rewriteQueryForRetrieval("q", HISTORY, "chat-1");
    expect(result).toBe("recovered");
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("does not serve a new chat's rewrite to an existing chat", async () => {
    // A brand new chat has no id yet. That must be its own key, not a wildcard.
    await rewriteQueryForRetrieval("q", HISTORY, undefined);
    await rewriteQueryForRetrieval("q", HISTORY, "chat-1");
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("evicts the oldest entry rather than growing without bound", async () => {
    // 101 distinct queries against a 100-entry cache.
    for (let i = 0; i < 101; i++) {
      await rewriteQueryForRetrieval(`q${i}`, HISTORY, "chat-1");
    }
    expect(generateText).toHaveBeenCalledTimes(101);

    // The oldest was evicted, so it costs a call again...
    await rewriteQueryForRetrieval("q0", HISTORY, "chat-1");
    expect(generateText).toHaveBeenCalledTimes(102);
    // ...while a recent one is still served from memory.
    await rewriteQueryForRetrieval("q100", HISTORY, "chat-1");
    expect(generateText).toHaveBeenCalledTimes(102);
  });
});
