/**
 * Every metered, GitHub-backed mutation must be rate limited per user.
 *
 * `create` is the only procedure that was guarded; `generateAiSummary` (which
 * spends a credit AND an LLM call) and `syncIssues` (a full delete-and-re-pull
 * of issues and PRs) were reachable without any limit at all. This pins the
 * guard so a future procedure can't be added without one.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/** Flipped by each test to simulate an exhausted window. */
let limitAllowed = true;

/**
 * Records the (scope, userId, request) each guarded procedure asked about, so
 * these tests can prove the IP dimension is reachable at all — mocking
 * `rateLimit` away, as this file used to, could not see it.
 */
const limitCalls: { scope: string; userId: string; req: Request | null }[] = [];

vi.mock("@/src/lib/rate-limit", () => ({
  enforceLimits: async (
    scope: string,
    userId: string,
    req?: Request | null,
  ) => {
    limitCalls.push({ scope, userId, req: req ?? null });
    return {
      allowed: limitAllowed,
      limit: 10,
      remaining: limitAllowed ? 9 : 0,
      scope: "user",
    };
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_1" }),
}));

const serviceCalls: string[] = [];

vi.mock(
  "@/src/features/dashboard/server/router/services/projectService",
  () => ({
    createProjectService: () => ({
      createProject: async () => {
        serviceCalls.push("create");
        return { id: "p1" };
      },
      generateAiSummary: async () => {
        serviceCalls.push("generateAiSummary");
        return { summary: "s" };
      },
      syncIssues: async () => {
        serviceCalls.push("syncIssues");
        return { issues: 0, pullRequests: 0 };
      },
    }),
  }),
);

import { projectRouter } from "@/src/features/dashboard/server/router/project";
import { createCallerFactory } from "@/src/lib/trpc/init";

const createCaller = createCallerFactory(projectRouter);

/** A request carrying an address, as the fetch adapter would always supply. */
const callerRequest = () =>
  new Request("http://localhost/api/trpc/project.create", {
    headers: { "x-vercel-forwarded-for": "203.0.113.7" },
  });

const caller = createCaller({
  userId: "user_1",
  req: callerRequest(),
  requestId: "test-request",
});

const UUID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  limitAllowed = true;
  limitCalls.length = 0;
  serviceCalls.length = 0;
});

/**
 * Each case names a procedure, the metered scope it must be limited under, and
 * a valid input. The scope is asserted, not derived: two procedures sharing a
 * scope would share a counter, which is a fact worth pinning.
 */
const MUTATIONS = [
  {
    name: "create",
    scope: "projectCreate",
    run: () => caller.create({ projectName: "p", repoUrl: "https://github.com/a/b" }),
  },
  {
    name: "generateAiSummary",
    scope: "summary",
    run: () => caller.generateAiSummary({ projectId: UUID, commitId: UUID }),
  },
  {
    name: "syncIssues",
    scope: "issuesSync",
    run: () => caller.syncIssues({ projectId: UUID }),
  },
] as const;

describe("project router rate limits", () => {
  for (const { name, scope, run } of MUTATIONS) {
    it(`${name} is rejected with TOO_MANY_REQUESTS once the window is exhausted`, async () => {
      limitAllowed = false;

      await expect(run()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    });

    it(`${name} does not reach the service when the window is exhausted`, async () => {
      limitAllowed = false;

      await run().catch(() => undefined);

      expect(serviceCalls).not.toContain(name);
    });

    it(`${name} is limited against the caller and not anyone else`, async () => {
      await run();

      expect(limitCalls).toHaveLength(1);
      expect(limitCalls[0]!.userId).toBe("user_1");
      expect(limitCalls[0]!.scope).toBe(scope);
    });

    it(`${name} hands the limiter the request, so the IP dimension is reachable`, async () => {
      // A fresh Clerk account resets the user-scoped budget, so the IP ceiling
      // is the only thing standing between signup churn and unlimited spend.
      // If the procedure stopped passing `ctx.req`, that ceiling would silently
      // stop existing and nothing else in this file would notice.
      await run();

      expect(limitCalls[0]!.req).not.toBeNull();
    });

    it(`${name} still runs the service when the window allows it`, async () => {
      await run();

      expect(serviceCalls).toContain(name);
    });
  }
});
