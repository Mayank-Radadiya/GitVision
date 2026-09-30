/**
 * F-03 — starter-question chips.
 *
 * The chips are the onboarding surface for a project chat, and the one branch
 * that can be wrong silently is the auth gate: a project that *does* use Clerk
 * but gets no auth chip sends the developer to search for it themselves, and a
 * project that does not but gets one sends them after a table that does not
 * exist. So the gate, the chip count, and the "no model call" contract are
 * pinned here.
 *
 * Not run as part of F-03 (the Phase 0 rule forbids running the suite). Written
 * so it is runnable: `bunx vitest run src/__tests__/unit/starter-chips.test.ts`.
 */

import { describe, it, expect } from "vitest";
import {
  getStarterChips,
  parsePackageJsonDeps,
} from "@/src/features/chat/lib/starter-chips";

const AUTH_CHIP = "How does authentication and session management work?";

describe("parsePackageJsonDeps", () => {
  it("returns names from dependencies and devDependencies", () => {
    const deps = parsePackageJsonDeps(
      JSON.stringify({
        dependencies: { "@clerk/nextjs": "^6.0.0" },
        devDependencies: { vitest: "^4.0.0" },
      }),
    );

    expect(deps).toContain("@clerk/nextjs");
    expect(deps).toContain("vitest");
  });

  it("returns an empty list when the file was never indexed", () => {
    expect(parsePackageJsonDeps(undefined)).toEqual([]);
    expect(parsePackageJsonDeps(null)).toEqual([]);
    expect(parsePackageJsonDeps("")).toEqual([]);
  });

  it("returns an empty list for a body that is not JSON", () => {
    // A Go or Rust repository has no package.json, and a truncated file is not
    // worth a 500 on the chat page render.
    expect(parsePackageJsonDeps("<html>404 not found</html>")).toEqual([]);
  });

  it("tolerates a manifest whose dependency columns are not objects", () => {
    expect(parsePackageJsonDeps(JSON.stringify({ dependencies: 7 }))).toEqual([]);
    expect(parsePackageJsonDeps(JSON.stringify(["not", "an", "object"]))).toEqual(
      [],
    );
  });
});

describe("getStarterChips", () => {
  it("offers the auth question when an auth package is present", () => {
    const chips = getStarterChips(["TypeScript"], ["next", "@clerk/nextjs"]);

    expect(chips).toContain(AUTH_CHIP);
  });

  it("omits the auth question when no auth package is present", () => {
    const chips = getStarterChips(["Go"], ["github.com/gin-gonic/gin"]);

    expect(chips).not.toContain(AUTH_CHIP);
  });

  it("matches a scoped subpath of a known auth package", () => {
    expect(getStarterChips([], ["@clerk/nextjs/server"])).toContain(AUTH_CHIP);
  });

  it("does not match a package that merely starts with an auth package name", () => {
    // Substring matching here would put the auth chip on a repo that has no
    // authentication code in it at all.
    const chips = getStarterChips([], ["passport-mock", "next-auth-docs"]);

    expect(chips).not.toContain(AUTH_CHIP);
  });

  it("returns four chips either way, so the empty state never renders a ragged row", () => {
    expect(getStarterChips(["TypeScript"], ["@clerk/nextjs"])).toHaveLength(4);
    expect(getStarterChips(["TypeScript"], [])).toHaveLength(4);
    expect(getStarterChips([], [])).toHaveLength(4);
  });

  it("names the dominant languages in the architecture question", () => {
    const [architecture] = getStarterChips(["TypeScript", "CSS", "Shell"], []);

    expect(architecture).toBe(
      "What is the high-level architecture of this TypeScript + CSS codebase?",
    );
  });

  it("falls back to a stack-free architecture question when languages are unknown", () => {
    const [architecture] = getStarterChips([], []);

    expect(architecture).toBe(
      "What is the high-level architecture and tech stack of this repository?",
    );
  });

  it("is deterministic — the same record always produces the same chips", () => {
    const first = getStarterChips(["TypeScript"], ["@clerk/nextjs", "drizzle-orm"]);
    const second = getStarterChips(["TypeScript"], ["@clerk/nextjs", "drizzle-orm"]);

    expect(first).toEqual(second);
  });

  it("computes chips with no network access — a pure function of its arguments", () => {
    // If this ever needs a model call, the "four chips, instantly, for free"
    // promise of the empty state is gone, and the test's synchronous return
    // value is the first thing that stops type-checking.
    const chips = getStarterChips(["TypeScript"], ["@clerk/nextjs"]);

    expect(chips.every((c) => typeof c === "string" && c.length > 0)).toBe(true);
  });
});
