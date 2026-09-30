/**
 * `/api/embeddings` guarded all three of its handlers — except two of them.
 *
 * POST (the expensive one: it spends an LLM call per batch) was limited.
 * GET, which the client polls while an embedding job runs, and DELETE, which
 * cancels one, were both reachable with no limit at all. Polling without a
 * ceiling is a free amplification loop; DELETE without one means a single
 * authenticated user can cancel jobs at request speed.
 *
 * This pins both guards, and pins the two things that make them worth having:
 * the scope each is metered under, and that the request object is handed to
 * the limiter so the IP dimension is reachable.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/** Flipped by each test to simulate an exhausted window. */
let limitAllowed = true;

/**
 * Records the (scope, userId, request) each handler asked about, so these tests
 * can prove the IP dimension is reachable at all.
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

/** Downstream work, recorded so a 429 can be proven to short-circuit it. */
const downstreamCalls: string[] = [];

vi.mock("@/src/lib/guards", () => {
  // Declared inside the factory: vi.mock is hoisted above the module body, so a
  // top-level class would still be in its temporal dead zone when this runs.
  class ProjectAccessError extends Error {}

  return {
    ProjectAccessError,
    assertProjectOwnership: async (projectId: string) => {
      downstreamCalls.push("assertProjectOwnership");
      return {
        id: projectId,
        // Not "completed", so GET takes the plain return path and never reaches
        // the db. The auto-correct branch is not what these tests are about.
        embeddingStatus: "pending",
        embeddingProgress: 0,
        embeddingError: null,
      };
    },
  };
});

vi.mock("@/src/lib/inngest/client", () => ({
  inngest: {
    send: async () => {
      downstreamCalls.push("inngest.send");
      return { id: "evt_1" };
    },
  },
}));

/** Chainable no-op stand-in: db.update().set().where() is all these tests need. */
const chainable: unknown = {
  set: () => chainable,
  where: () => chainable,
  then: (resolve: (value: unknown) => void) => resolve(undefined),
};

vi.mock("@/db", () => ({
  db: {
    update: () => {
      downstreamCalls.push("db.update");
      return chainable;
    },
    select: () => chainable,
  },
}));

import { DELETE, GET } from "@/app/api/embeddings/route";

const UUID = "11111111-1111-4111-8111-111111111111";

const getRequest = () =>
  new Request(`http://localhost/api/embeddings?projectId=${UUID}`, {
    headers: { "x-vercel-forwarded-for": "203.0.113.7" },
  });

const deleteRequest = () =>
  new Request(`http://localhost/api/embeddings?projectId=${UUID}`, {
    method: "DELETE",
    headers: { "x-vercel-forwarded-for": "203.0.113.7" },
  });

/**
 * `POST` is included as the control: it was the one handler that was already
 * guarded, so if this table went red the harness is broken, not the route.
 */
const HANDLERS = [
  {
    name: "GET",
    scope: "embeddingsRead",
    run: () => GET(getRequest()),
  },
  {
    name: "DELETE",
    // Shares POST's counter on purpose: both mutate embedding state, and two
    // separate counters would be one more allowance to burn through.
    scope: "embeddings",
    run: () => DELETE(deleteRequest()),
  },
] as const;

beforeEach(() => {
  limitAllowed = true;
  limitCalls.length = 0;
  downstreamCalls.length = 0;
});

describe("embeddings route rate limits", () => {
  for (const { name, scope, run } of HANDLERS) {
    it(`${name} returns 429 once the window is exhausted`, async () => {
      limitAllowed = false;

      const res = await run();

      expect(res.status).toBe(429);
      await expect(res.json()).resolves.toHaveProperty("error");
    });

    it(`${name} does no project or cancel work when the window is exhausted`, async () => {
      limitAllowed = false;

      await run();

      expect(downstreamCalls).toEqual([]);
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
      await run();

      expect(limitCalls[0]!.req).not.toBeNull();
    });

    it(`${name} still does its work when the window allows it`, async () => {
      const res = await run();

      expect(res.status).toBe(200);
      expect(downstreamCalls).toContain("assertProjectOwnership");
    });
  }
});

describe("GET and DELETE do not share a counter", () => {
  it("meters reads separately from mutations", async () => {
    // If a client polls a long job, GET must not eat the budget that POST and
    // DELETE need. Pinned because a single shared scope would silently make
    // the 30/60 read ceiling throttle generation.
    await GET(getRequest());
    await DELETE(deleteRequest());

    expect(limitCalls.map((c) => c.scope)).toEqual([
      "embeddingsRead",
      "embeddings",
    ]);
  });
});
