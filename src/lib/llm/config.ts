/**
 * Pinned snapshot id. Deliberately not a floating `-latest` alias: an alias can
 * be repointed to new weights or a new safety configuration by the provider with
 * no deploy, no commit and no changelog entry, so summary output and cost would
 * change under a running system. A dated/`-001` id only moves when we move it.
 * To re-validate, swap back to the floating flash alias, diff summaries on a
 * sample of real commit diffs, then land the new pinned id here.
 */
export const PINNED_GEMINI_FLASH = "gemini-2.0-flash-001";

/**
 * Central tuning point for all Gemini model calls.
 *
 * Every value here bounds cost, latency, or hang-time for a model invocation.
 * Keep the numbers in one place so tuning is a single edit.
 */

export const LLM_SETTINGS = {
  /**
   * Main chat answer (streamed). Generous total for long code answers; the
   * streaming fields abort a stalled stream rather than a slow-but-moving one.
   */
  chat: {
    model: PINNED_GEMINI_FLASH,
    maxRetries: 2,
    maxOutputTokens: 2048,
    timeout: { totalMs: 90_000, firstChunkMs: 20_000, chunkMs: 10_000 },
  },
  /**
   * Best-effort standalone-query rewrite. Falls back to the raw message on
   * failure, so retrying is not worth the added latency.
   */
  queryRewrite: {
    model: PINNED_GEMINI_FLASH,
    maxRetries: 1,
    maxOutputTokens: 40,
    timeout: { totalMs: 10_000, stepMs: 10_000 },
  },
  /**
   * Commit-diff summary. Called from a background GitHub service (no request
   * abort signal available).
   */
  commitSummary: {
    model: PINNED_GEMINI_FLASH,
    maxRetries: 2,
    maxOutputTokens: 1500,
    timeout: { totalMs: 30_000, stepMs: 30_000 },
  },
} as const;
