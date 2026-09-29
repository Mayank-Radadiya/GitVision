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

/** Records the key each guarded procedure asked about. */
const limitedKeys: string[] = [];

vi.mock("@/src/lib/rate-limit", () => ({
  rateLimit: async (key: string) => {
    limitedKeys.push(key);
    return { allowed: limitAllowed, limit: 10, remaining: limitAllowed ? 9 : 0 };
  },
  keys: new Proxy(
    {},
    {
      get: (_target, name: string) => (userId: string) => `${name}:${userId}`,
    },
  ),
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
const caller = createCaller({ userId: "user_1", req: undefined });

const UUID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  limitAllowed = true;
  limitedKeys.length = 0;
  serviceCalls.length = 0;
});

/** Each case names a procedure, a valid input, and the key it must be limited by. */
const MUTATIONS = [
  {
    name: "create",
    run: () => caller.create({ projectName: "p", repoUrl: "https://github.com/a/b" }),
  },
  {
    name: "generateAiSummary",
    run: () => caller.generateAiSummary({ projectId: UUID, commitId: UUID }),
  },
  { name: "syncIssues", run: () => caller.syncIssues({ projectId: UUID }) },
] as const;

describe("project router rate limits", () => {
  for (const { name, run } of MUTATIONS) {
    it(`${name} is rejected with TOO_MANY_REQUESTS once the window is exhausted`, async () => {
      limitAllowed = false;

      await expect(run()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    });

    it(`${name} does not reach the service when the window is exhausted`, async () => {
      limitAllowed = false;

      await run().catch(() => undefined);

      expect(serviceCalls).not.toContain(name);
    });

    it(`${name} is limited against a key scoped to the caller`, async () => {
      await run();

      expect(limitedKeys).toHaveLength(1);
      expect(limitedKeys[0]).toContain("user_1");
    });

    it(`${name} still runs the service when the window allows it`, async () => {
      await run();

      expect(serviceCalls).toContain(name);
    });
  }
});
