/**
 * Self-check for the shared chat error contract (src/shared/lib/chat-errors).
 * Run: npx tsx scripts/llm-safety-selfcheck.ts
 */
import assert from "node:assert/strict";
import {
  categorizeModelError,
  parseChatError,
} from "../src/shared/lib/chat-errors";

// --- categorizeModelError (server-side) ---

assert.equal(categorizeModelError({ statusCode: 429 }).code, "rate_limited");
assert.equal(
  categorizeModelError({ statusCode: 500, name: "AI_APICallError" }).code,
  "model_error",
);
assert.equal(
  categorizeModelError({ name: "TimeoutError", message: "timeout of 90000ms exceeded" }).code,
  "timeout",
);
// RetryError unwraps to the last underlying error.
assert.equal(
  categorizeModelError({ name: "AI_RetryError", errors: [{ statusCode: 502 }] }).code,
  "model_error",
);
assert.equal(categorizeModelError(new Error("boom")).code, "model_error");

// --- parseChatError (client-side) ---

assert.equal(parseChatError(null), null);
assert.equal(parseChatError(undefined), null);
// User-initiated stop → no banner.
assert.equal(parseChatError({ name: "AbortError", message: "The operation was aborted." }), null);
// Server stream error payload (JSON in error.message).
const timeoutErr = parseChatError({
  message: JSON.stringify({ code: "timeout", message: "The AI took too long to respond." }),
});
assert.deepEqual(timeoutErr, {
  code: "timeout",
  message: "The AI took too long to respond.",
  title: "Request timed out",
  retryable: true,
});
// Pre-stream HTTP body (JSON with `error` + `code`).
const creditsErr = parseChatError({
  message: JSON.stringify({ error: "You're out of credits. Please top up.", code: "out_of_credits" }),
});
assert.equal(creditsErr?.code, "out_of_credits");
assert.equal(creditsErr?.retryable, false);
assert.equal(creditsErr?.message, "You're out of credits. Please top up.");
// code "aborted" → no banner.
assert.equal(
  parseChatError({ message: JSON.stringify({ code: "aborted", message: "" }) }),
  null,
);
// Plain transport text → network, retryable.
const netErr = parseChatError({ message: "Failed to fetch" });
assert.equal(netErr?.code, "network");
assert.equal(netErr?.retryable, true);
// Plain transport text mentioning timeout → timeout.
assert.equal(parseChatError({ message: "fetch timed out" })?.code, "timeout");
// statusCode fallback (non-JSON error objects).
assert.equal(parseChatError({ message: "nope", statusCode: 402 })?.code, "out_of_credits");
assert.equal(parseChatError({ message: "nope", statusCode: 429 })?.code, "rate_limited");
assert.equal(parseChatError({ message: "nope", statusCode: 500 })?.code, "server_error");

console.log("✅ llm-safety self-check passed");
