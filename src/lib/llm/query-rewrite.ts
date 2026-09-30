/**
 * LLM-based standalone query rewrite.
 *
 * Uses a small Gemini Flash call to rewrite the conversation into a
 * standalone search query. This prevents query drift on long threads and
 * produces a better embedding input than raw user messages.
 *
 * Returns the original userMessage as a fallback if the call fails.
 */

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { LLM_SETTINGS } from "@/src/lib/llm/config";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Bounded cache of successful rewrites. A retry or a stream resume replays the
// same (chat, query) pair, and each miss is a billable round-trip to the model.
// Bounded rather than unbounded so a long-lived process cannot grow it forever.
const MAX_REWRITE_CACHE = 100;
const rewriteCache = new Map<string, string>();

function cacheKey(
  chatId: string | undefined,
  userMessage: string,
  conversationHistory: string,
): string {
  // The history is part of the input and therefore part of the output. Its
  // length is enough to separate distinct histories without putting a whole
  // transcript in every key. A new chat has no id yet; that is a key of its
  // own, not a wildcard — a brand new chat's rewrite must not be served to an
  // existing one, or vice versa.
  return `${chatId ?? "new"}:${conversationHistory.length}:${userMessage.trim()}`;
}

function getCached(key: string): string | undefined {
  const hit = rewriteCache.get(key);
  if (hit !== undefined) {
    // Re-insert so the most recently used key is evicted last.
    rewriteCache.delete(key);
    rewriteCache.set(key, hit);
  }
  return hit;
}

function setCached(key: string, value: string): void {
  if (rewriteCache.size >= MAX_REWRITE_CACHE) {
    const oldest = rewriteCache.keys().next().value;
    if (oldest !== undefined) rewriteCache.delete(oldest);
  }
  rewriteCache.set(key, value);
}

/** Test-only. */
export function clearRewriteCache(): void {
  rewriteCache.clear();
}

export async function rewriteQueryForRetrieval(
  userMessage: string,
  conversationHistory: string,
  chatId: string | undefined,
  abortSignal?: AbortSignal,
): Promise<string> {
  // If there's no real history, the current message is already standalone
  if (
    !conversationHistory ||
    conversationHistory === "No previous conversation."
  ) {
    return userMessage;
  }

  const key = cacheKey(chatId, userMessage, conversationHistory);
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  try {
    const { text } = await generateText({
      model: google(LLM_SETTINGS.queryRewrite.model),
      maxRetries: LLM_SETTINGS.queryRewrite.maxRetries,
      maxOutputTokens: LLM_SETTINGS.queryRewrite.maxOutputTokens,
      timeout: LLM_SETTINGS.queryRewrite.timeout,
      abortSignal,
      system: `You are a search query optimizer for a code repository.
Given a conversation and the user's latest message, output ONLY a concise
standalone search query (max 20 words) that captures what the user wants to
find in the codebase. Output nothing else — no explanation, no punctuation
at the end.`,
      messages: [
        {
          role: "user",
          content: `Conversation so far:\n${conversationHistory}\n\nLatest message: ${userMessage}`,
        },
      ],
    });

    const result = text.trim() || userMessage;
    setCached(key, result);
    return result;
  } catch {
    // Not cached: a transient failure should not be pinned for the process.
    return userMessage;
  }
}
