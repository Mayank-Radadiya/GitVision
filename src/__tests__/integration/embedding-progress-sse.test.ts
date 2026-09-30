import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * The indexing-progress stream is the first ReadableStream endpoint in the
 * repo, so these tests pin the two things that make it safe: the pre-flight
 * rejects the same way every other project-scoped route does, and the stream
 * never outlives the request.
 *
 * vi.mock is hoisted above the module body, so anything a factory closes over
 * must be created inside the factory or assigned in beforeEach.
 */

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const TICK_MS = 1_500;

let limitAllowed = true;
let limitCalls: { scope: string; userId: string; req: unknown }[] = [];
let authResult: { userId: string | null } = { userId: "user_1" };
let ownership: "ok" | "denied" = "ok";
let ownershipCalls: { projectId: string; userId: string }[] = [];

/** The row the streaming `select` returns. Mutated mid-test to drive ticks. */
let currentRow: Record<string, unknown> | undefined;
let selectError: Error | null = null;
/** Aborting this is what a client disconnect looks like to the route. */
let disconnect: AbortController;

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => authResult),
}));

vi.mock("@/src/lib/rate-limit", () => ({
  enforceLimits: vi.fn(
    async (scope: string, userId: string, req: unknown) => {
      limitCalls.push({ scope, userId, req });
      return {
        allowed: limitAllowed,
        limit: 30,
        remaining: limitAllowed ? 29 : 0,
        scope: "user",
      };
    },
  ),
}));

vi.mock("@/src/lib/guards", () => {
  // Declared inside the factory: a top-level class would still be in its
  // temporal dead zone when the hoisted factory runs.
  class ProjectAccessError extends Error {
    name = "ProjectAccessError";
  }
  return {
    ProjectAccessError,
    assertProjectOwnership: async (projectId: string, userId: string) => {
      ownershipCalls.push({ projectId, userId });
      if (ownership === "denied") {
        throw new ProjectAccessError("Project not found");
      }
      return { id: projectId, embeddingStatus: "pending" };
    },
  };
});

vi.mock("@/db", () => {
  const chainable = {
    from: () => chainable,
    where: () => chainable,
    limit: () => chainable,
    // Both callbacks must be invoked: returning a rejected promise from a
    // thenable without calling `reject` leaves the awaiting promise unsettled
    // and the returned one unhandled.
    then: (resolve: (value: unknown) => unknown, reject: (r: unknown) => unknown) => {
      if (selectError) return reject(selectError);
      return resolve(currentRow === undefined ? [] : [currentRow]);
    },
  };
  return { db: { select: () => chainable } };
});

vi.mock("@/src/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const processingRow = (over: Record<string, unknown> = {}) => ({
  status: "processing",
  percentage: 40,
  indexedFileCount: 20,
  totalFileCount: 50,
  error: null,
  ...over,
});

const open = async (query = `projectId=${PROJECT_ID}`) => {
  const { GET } = await import("@/app/api/embeddings/progress/route");
  return GET(
    new Request(`http://localhost/api/embeddings/progress?${query}`, {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.7",
        "x-request-id": "req_test",
      },
      signal: disconnect.signal,
    }) as NextRequest,
  );
};

/**
 * Drains `wanted` SSE frames, stepping the route's interval by hand. Stops
 * early if the stream closes, which is how the "does not leak" assertions
 * detect a missing close.
 */
async function readFrames(res: Response, wanted: number): Promise<string[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const frames: string[] = [];

  for (let step = 0; step < 20 && frames.length < wanted; step++) {
    await vi.advanceTimersByTimeAsync(TICK_MS);
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split: number;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      frames.push(buffer.slice(0, split));
      buffer = buffer.slice(split + 2);
    }
  }

  await reader.cancel();
  return frames;
}

const parseEvent = (frame: string) =>
  JSON.parse(frame.replace(/^data: /, "")) as Record<string, unknown>;

beforeEach(() => {
  limitAllowed = true;
  limitCalls = [];
  authResult = { userId: "user_1" };
  ownership = "ok";
  ownershipCalls = [];
  currentRow = undefined;
  selectError = null;
  disconnect = new AbortController();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(async () => {
  // Every route instance from this test tears its interval down here. Without
  // it a leaked loop from an earlier case keeps ticking into the next one.
  disconnect.abort();
  await vi.runOnlyPendingTimersAsync();
  vi.useRealTimers();
});

describe("GET /api/embeddings/progress — pre-flight", () => {
  it("rejects an unauthenticated request before opening a stream", async () => {
    authResult = { userId: null };

    const res = await open();

    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("returns 429 when the read budget is exhausted", async () => {
    limitAllowed = false;

    const res = await open();

    expect(res.status).toBe(429);
  });

  it("meters under the embeddingsRead scope and threads the raw request through", async () => {
    // The IP dimension of enforceLimits is only reachable when `req` is passed;
    // an SSE connection is one long-lived request, not a per-tick one.
    currentRow = processingRow();

    const res = await open();

    expect(limitCalls).toHaveLength(1);
    expect(limitCalls[0].scope).toBe("embeddingsRead");
    expect(limitCalls[0].userId).toBe("user_1");
    expect(limitCalls[0].req).toBeInstanceOf(Request);
    expect(res.status).toBe(200);
  });

  it.each([
    ["a missing project id", ""],
    ["a non-uuid project id", "projectId=not-a-uuid"],
  ])("returns 400 for %s", async (_label, query) => {
    const res = await open(query);

    expect(res.status).toBe(400);
    expect(ownershipCalls).toHaveLength(0);
  });

  it("returns 404 without leaking existence when the project is not the caller's", async () => {
    ownership = "denied";

    const res = await open();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Project not found" });
  });
});

describe("GET /api/embeddings/progress — stream", () => {
  it("sends the headers a proxy needs in order not to buffer the response", async () => {
    currentRow = processingRow();

    const res = await open();

    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");
    // nginx and most CDNs buffer by default, which would defeat streaming.
    expect(res.headers.get("x-accel-buffering")).toBe("no");
  });

  it("emits the current counters immediately rather than after the first tick", async () => {
    currentRow = processingRow();

    const frames = await readFrames(await open(), 1);

    expect(parseEvent(frames[0])).toEqual({
      status: "processing",
      percentage: 40,
      indexedFileCount: 20,
      totalFileCount: 50,
      error: null,
      phase: "embedding",
    });
  });

  it("forwards a new payload on the next tick", async () => {
    currentRow = processingRow();
    const res = await open();

    const frames: string[] = [];
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    let buffer = decoder.decode((await reader.read()).value);
    buffer += buffer.indexOf("\n\n") !== -1 ? "" : "";
    frames.push(buffer.split("\n\n")[0]);

    currentRow = processingRow({ percentage: 60, indexedFileCount: 30 });
    await vi.advanceTimersByTimeAsync(TICK_MS);
    buffer += decoder.decode((await reader.read()).value);

    for (const frame of buffer.split("\n\n").slice(1)) {
      if (frame) frames.push(frame);
    }
    await reader.cancel();

    expect(parseEvent(frames[0])).toMatchObject({ indexedFileCount: 20 });
    expect(parseEvent(frames[1])).toMatchObject({
      indexedFileCount: 30,
      percentage: 60,
    });
  });

  it("does not re-send an unchanged payload", async () => {
    // The row sits still while the loop ticks 20 times. Only when it changes
    // does a frame go out — so if the dedupe were broken, a duplicate of the
    // first frame would arrive ahead of the new one.
    currentRow = processingRow();
    const res = await open();
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    const first = decoder.decode((await reader.read()).value);
    await vi.advanceTimersByTimeAsync(TICK_MS * 20);

    currentRow = processingRow({ percentage: 60, indexedFileCount: 30 });
    await vi.advanceTimersByTimeAsync(TICK_MS);
    const second = decoder.decode((await reader.read()).value);
    await reader.cancel();

    expect(parseEvent(first.split("\n\n")[0])).toMatchObject({
      indexedFileCount: 20,
    });
    expect(parseEvent(second.split("\n\n")[0])).toMatchObject({
      indexedFileCount: 30,
    });
  });

  it("closes the stream after a terminal event so the connection cannot leak", async () => {
    currentRow = processingRow({
      status: "completed",
      percentage: 100,
      indexedFileCount: 50,
    });

    const res = await open();
    const reader = res.body!.getReader();
    await vi.advanceTimersByTimeAsync(TICK_MS);
    const { value, done } = await reader.read();
    const frame = new TextDecoder().decode(value);

    expect(parseEvent(frame.split("\n\n")[0])).toMatchObject({
      status: "completed",
      phase: "completed",
      indexedFileCount: 50,
    });
    // The next read resolving means the controller was closed, not left hanging.
    await expect(reader.read()).resolves.toMatchObject({ done: true });
  });

  it("closes on a partial run too", async () => {
    // The old 2s poll only stopped on completed/failed, so a capped project
    // polled forever at 100%.
    currentRow = processingRow({
      status: "partial",
      percentage: 100,
      indexedFileCount: 50,
      error: "capped",
    });

    const frames = await readFrames(await open(), 5);

    expect(frames).toHaveLength(1);
    expect(parseEvent(frames[0])).toMatchObject({ status: "partial" });
  });

  it("closes when the project row disappears mid-stream", async () => {
    currentRow = undefined;

    const res = await open();
    const reader = res.body!.getReader();
    await vi.advanceTimersByTimeAsync(TICK_MS);
    await reader.read();

    await expect(reader.read()).resolves.toMatchObject({ done: true });
  });

  it("tears the loop down when the client disconnects", async () => {
    currentRow = processingRow();
    const res = await open();
    const reader = res.body!.getReader();
    await reader.read();

    disconnect.abort();
    await vi.runOnlyPendingTimersAsync();

    // The read rejects rather than resolving done: the route errors the
    // controller on abort, because a client that vanished is a broken pipe,
    // not a clean end-of-stream. Either way the loop is gone.
    await expect(reader.read()).rejects.toThrow("client disconnected");
  });

  it("closes the stream when the polling query throws", async () => {
    // A failure after the response has started cannot become a status code, so
    // the only correct move is to end the stream and let the client fall back.
    currentRow = processingRow();
    selectError = new Error("connection reset");

    const res = await open();
    const reader = res.body!.getReader();
    await vi.advanceTimersByTimeAsync(TICK_MS);

    await expect(reader.read()).resolves.toMatchObject({ done: true });
  });
});
