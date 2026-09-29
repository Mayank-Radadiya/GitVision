/**
 * The GitHub client must not be built at module load.
 *
 * It used to `throw` at module evaluation when GITHUB_TOKEN was unset. Every
 * tRPC route that transitively imports `src/lib/github/index.ts` — including
 * chat, which never touches GitHub — died on import, and `next build` could
 * break. Fail-fast is still the behaviour; it just happens on first use, where
 * the token is genuinely needed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_TOKEN = process.env.GITHUB_TOKEN;

beforeEach(() => {
  delete process.env.GITHUB_TOKEN;
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = ORIGINAL_TOKEN;
});

describe("github client construction", () => {
  it("imports without GITHUB_TOKEN set", async () => {
    await expect(import("@/src/lib/github/client")).resolves.toBeDefined();
  });

  it("names the missing variable when the client is actually requested", async () => {
    const { getOctokit } = await import("@/src/lib/github/client");

    expect(() => getOctokit()).toThrow(/GITHUB_TOKEN/);
  });

  it("memoises one client across calls", async () => {
    process.env.GITHUB_TOKEN = "ghp_test";
    const { getOctokit } = await import("@/src/lib/github/client");

    expect(getOctokit()).toBe(getOctokit());
  });
});
