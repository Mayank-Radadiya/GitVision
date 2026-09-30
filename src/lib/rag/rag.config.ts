/**
 * RAG thresholds in one place (T-083).
 *
 * These four numbers used to be module-local consts in three different files
 * (`vector-search.ts` and `budget.ts`), which is how the small-project dump
 * threshold ended up as an open question in the planning docs — the value that
 * decides "dump the whole repo" lived 900 lines away from the value that
 * decides "how many tokens may the prompt use", and neither documented the
 * other. Moving them here makes the whole retrieval budget auditable at a
 * glance and gives future tuning one file to edit.
 */
export const RAG_CONFIG = {
  /**
   * A project whose estimated token count is below this qualifies for the
   * "full dump" fast path (no vector search, no per-query retrieval).
   *
   * Settled at 150_000 rather than the 24K the planning docs floated: the dump
   * is then cut by `maxContextTokens` anyway, so a smaller threshold only buys
   * the pathological case where a huge repo is *cheaply* estimated and then
   * truncated mid-file. See `docs/DECISIONS.md` D-3.
   */
  smallProjectTokenThreshold: 150_000,

  /** Ceiling on files pulled into memory by the full-dump path. Matches D-3. */
  maxContextFiles: 500,

  /**
   * Per-file cap. `fitToBudget` cuts on file boundaries, so it can never trim
   * an oversized file on its own. 50k chars is ~12.5k tokens at the 4
   * chars/token estimate — two such files already fill a 32k budget, so this is
   * generous but not fatal.
   */
  maxFileChars: 50_000,

  /**
   * Ceiling on the tokens handed to the model as context, independent of the
   * provider's window. `computeBudget` also applies the provider's real limit,
   * so this is the outer bound, not the only one.
   */
  maxContextTokens: 32_768,
} as const;

export type RagConfig = typeof RAG_CONFIG;
