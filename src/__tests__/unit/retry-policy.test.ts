/**
 * Which failures are worth asking again.
 *
 * React Query's default is `isServer() ? 0 : 3`, and no query in this app
 * overrode it. That made a permanent `NOT_FOUND` — a project the user deleted —
 * cost four requests and ~7s of backoff per poll tick, on top of the poll loop
 * itself. Worse, the server and the browser disagreed: `fetchQuery` forces
 * `retry: false`, so a prefetch the server resolved to 404 never retried while
 * the browser re-issued the same query three more times.
 *
 * The policy is a pure function on purpose so the set of permanent codes is
 * assertable as a set rather than inferred from timing.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_QUERY_RETRIES,
  TERMINAL_ERROR_CODES,
  makeQueryClient,
  shouldRetry,
} from "@/src/lib/trpc/query-client";

/** Shaped like a `TRPCClientError`: `data.code` is the string key. */
function trpcError(code: string) {
  return { name: "TRPCClientError", message: "nope", data: { code, httpStatus: 404 } };
}

describe("TERMINAL_ERROR_CODES", () => {
  it("lists the eight codes that mean the server already gave its final answer", () => {
    expect([...TERMINAL_ERROR_CODES].sort()).toEqual([
      "BAD_REQUEST",
      "FORBIDDEN",
      "METHOD_NOT_SUPPORTED",
      "NOT_FOUND",
      "PARSE_ERROR",
      "PRECONDITION_FAILED",
      "UNAUTHORIZED",
      "UNSUPPORTED_MEDIA_TYPE",
    ]);
  });

  it("excludes the codes where a later attempt can plausibly differ", () => {
    for (const code of ["INTERNAL_SERVER_ERROR", "TIMEOUT", "TOO_MANY_REQUESTS", "CONFLICT"]) {
      expect(TERMINAL_ERROR_CODES).not.toContain(code);
    }
  });
});

describe("shouldRetry", () => {
  it("never retries a terminal code, at any attempt count", () => {
    for (const code of TERMINAL_ERROR_CODES) {
      expect(shouldRetry(0, trpcError(code))).toBe(false);
      expect(shouldRetry(5, trpcError(code))).toBe(false);
    }
  });

  it("retries a transient code up to the budget", () => {
    for (const code of ["INTERNAL_SERVER_ERROR", "TIMEOUT", "TOO_MANY_REQUESTS"]) {
      expect(shouldRetry(0, trpcError(code))).toBe(true);
      expect(shouldRetry(MAX_QUERY_RETRIES - 1, trpcError(code))).toBe(true);
      expect(shouldRetry(MAX_QUERY_RETRIES, trpcError(code))).toBe(false);
    }
  });

  it("retries an error that carries no tRPC code, because it may be a dropped connection", () => {
    const dropped = new TypeError("Failed to fetch");
    expect(shouldRetry(0, dropped)).toBe(true);
    expect(shouldRetry(MAX_QUERY_RETRIES - 1, dropped)).toBe(true);
    expect(shouldRetry(MAX_QUERY_RETRIES, dropped)).toBe(false);
  });

  it("survives non-object throws instead of throwing itself", () => {
    expect(shouldRetry(0, "boom")).toBe(true);
    expect(shouldRetry(0, null)).toBe(true);
    expect(shouldRetry(0, undefined)).toBe(true);
    expect(shouldRetry(0, { data: { code: 42 } })).toBe(true);
    expect(shouldRetry(0, { data: null })).toBe(true);
  });

  it("is actually wired as the client default, not merely exported", () => {
    // A policy nothing calls is a policy that does not exist. This is the one
    // assertion that fails if someone drops `retry:` from `makeQueryClient`.
    expect(makeQueryClient().getDefaultOptions().queries?.retry).toBe(shouldRetry);
  });
});
