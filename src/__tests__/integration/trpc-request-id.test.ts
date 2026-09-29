/**
 * The tRPC route used to log errors with a bare `console.error`, so an error
 * line in production carried no request id and could not be tied back to the
 * call that caused it. This pins both halves of the fix: the error goes
 * through the structured logger, and the id comes from `x-request-id`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger } from "@/src/lib/logger";
import { createTRPCContext } from "@/src/lib/trpc/init";

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: null }),
}));

vi.mock("@/src/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// A tiny router that always throws, so the adapter reaches `onError` without
// dragging the real routers (and their database clients) into the test.
vi.mock("@/src/lib/trpc/routers/_app", async () => {
  const { initTRPC } = await import("@trpc/server");
  const t = initTRPC.context<Record<string, never>>().create();
  return {
    appRouter: t.router({
      boom: t.procedure.query(() => {
        throw new Error("boom");
      }),
    }),
  };
});

const { GET } = await import("@/app/api/trpc/[trpc]/route");

function get(headers: Record<string, string> = {}) {
  return GET(
    new Request("http://localhost/api/trpc/boom", { headers }),
  );
}

beforeEach(() => {
  vi.mocked(logger.error).mockClear();
});

describe("tRPC error logging", () => {
  it("logs the failing path through the logger with the incoming request id", async () => {
    await get({ "x-request-id": "req-123" });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("boom"),
      expect.anything(),
      expect.objectContaining({ requestId: "req-123" }),
    );
  });

  it("still returns the security headers on a failed request", async () => {
    const response = await get({ "x-request-id": "req-123" });

    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });
});

describe("createTRPCContext", () => {
  it("takes the request id from x-request-id", async () => {
    const ctx = await createTRPCContext({
      req: new Request("http://localhost/api/trpc/boom", {
        headers: { "x-request-id": "req-abc" },
      }),
    });

    expect(ctx.requestId).toBe("req-abc");
  });

  it("invents a request id when the header is missing", async () => {
    const ctx = await createTRPCContext({
      req: new Request("http://localhost/api/trpc/boom"),
    });

    expect(ctx.requestId).toBeTruthy();
  });
});
