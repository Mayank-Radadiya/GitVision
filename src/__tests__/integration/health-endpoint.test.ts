import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * H14 — /api/health.
 *
 * The contract under test is the status code an uptime monitor polls: 200
 * while the pipeline is healthy, 503 the moment a project is wedged in
 * "processing". Everything else in the payload is diagnostics.
 *
 * "Stuck" deliberately means *no progress*, not *running a long time*. The
 * embedding pipeline is allowed up to 30 minutes (see the `retries`/duration
 * comment in src/lib/inngest/functions.ts), so a flat age-since-claim check
 * would page on every healthy large repo. `updatedAt` is rewritten on each
 * progress write, which makes it the heartbeat we can actually trust.
 */

const STUCK = {
  id: "p1",
  projectName: "stuck-repo",
  embeddingStatus: "processing",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const selectCalls: { table: string; limit?: number; fields?: string[] }[] = [];
let stuckRows: (typeof STUCK)[] = [];
let probeThrows = false;
let stuckQueryThrows = false;

/** Records every `auth.protect()` call the real middleware makes. */
let protectedPaths: string[] = [];

/** Applies a column projection, the way Drizzle would. */
const pick = (row: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, row[k]]));

vi.mock("@/db", () => {
  // Liveness probe — the route reaches for `execute` here, not `select`,
  // because "is Postgres up" is not a table question.
  const execute = () =>
    probeThrows
      ? Promise.reject(new Error("connection refused"))
      : Promise.resolve([{ ok: 1 }]);

  const select = (fields?: Record<string, unknown>) => {
    const keys = fields ? Object.keys(fields) : [];
    selectCalls.push({ table: "projects", fields: keys });
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: (n: number) => {
        selectCalls[selectCalls.length - 1].limit = n;
        return chain;
      },
      // A proper thenable: invoke the handler the awaiter supplies. Returning
      // a rejected promise from `then` instead leaves the rejection unhandled
      // and never settles the await, which is a mock bug, not a route bug.
      then: (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown,
      ) => {
        if (stuckQueryThrows) return reject?.(new Error("relation does not exist"));
        // Honour the projection. A mock that hands back the whole row would
        // report a leak whether or not the route asked for the name, which is
        // the false confidence this file exists to end.
        return resolve(
          keys.length ? stuckRows.map((r) => pick(r, keys)) : stuckRows,
        );
      },
    };
    return chain;
  };

  return { db: { execute, select } };
});

vi.mock("@/src/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@clerk/nextjs/server", async () => {
  const actual = await vi.importActual<typeof import("@clerk/nextjs/server")>(
    "@clerk/nextjs/server",
  );
  return {
    ...actual,
    // Real createRouteMatcher, signed-out session. The question under test is
    // which paths reach `auth.protect()`, not what Clerk does once they do.
    clerkMiddleware:
      (handler: (auth: unknown, req: unknown) => unknown) =>
      async (req: unknown) => {
        const url = new URL((req as { url: string }).url);
        return handler(
          {
            userId: null,
            protect: () => {
              protectedPaths.push(url.pathname);
            },
          },
          req,
        );
      },
  };
});

// The threshold constant is imported from `src/lib/health` rather than the
// route: Next.js rejects a non-route export from `route.ts` at build time.
const { GET } = await import("@/app/api/health/route");
const { STUCK_AFTER_MS } = await import("@/src/lib/health");
const { default: middleware } = await import("@/proxy");

beforeEach(() => {
  selectCalls.length = 0;
  stuckRows = [];
  probeThrows = false;
  stuckQueryThrows = false;
  protectedPaths = [];
});

describe("GET /api/health", () => {
  it("reports 200 while the database is reachable and nothing is wedged", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("up");
    expect(body.stuckProjects).toEqual([]);
  });

  it("reports 503 when the database cannot be reached", async () => {
    probeThrows = true;

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.database).toBe("down");
  });

  it("does not leak the database error message to the response body", async () => {
    probeThrows = true;

    const body = await (await GET()).json();

    expect(JSON.stringify(body)).not.toContain("connection refused");
  });

  it("reports 503 and identifies the project when one is stuck in processing", async () => {
    stuckRows = [STUCK];

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.database).toBe("up");
    expect(body.stuckProjects).toHaveLength(1);
    expect(body.stuckProjects[0].id).toBe("p1");
  });

  it("keeps customer project names out of the degraded body", async () => {
    // The endpoint is public, so this body is readable by anyone who can find
    // the URL. The id is enough to act on; the name is the customer's data.
    stuckRows = [STUCK];

    const body = await (await GET()).json();

    expect(JSON.stringify(body)).not.toContain("stuck-repo");
  });

  it("bounds the stuck-project lookup so a wedged queue cannot grow the response", async () => {
    await GET();

    const stuckQuery = selectCalls.find((c) => c.table === "projects");
    expect(stuckQuery?.limit).toBe(20);
  });

  it("uses a threshold longer than a single embedding step", () => {
    // Guards against someone "tightening" this to a few minutes and paging
    // on every slow batch. 15 minutes of zero progress, not 15 minutes total.
    expect(STUCK_AFTER_MS).toBe(15 * 60 * 1000);
  });

  it("reports 503 when the stuck query itself fails, rather than reading it as healthy", async () => {
    stuckQueryThrows = true;

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("unhealthy");
  });
});

describe("signed-out reachability of /api/health", () => {
  // Every other test in this file calls `GET()` directly, which is why the
  // endpoint could sit behind a sign-in redirect for this long and still have a
  // green suite. This one goes through the middleware the request really hits.
  it("passes the middleware without asking for a session, then reaches the handler", async () => {
    await middleware(
      new NextRequest("http://localhost/api/health") as never,
      {} as never,
    );

    expect(protectedPaths).not.toContain("/api/health");

    const res = await GET();

    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });
});
