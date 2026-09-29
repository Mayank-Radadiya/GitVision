/**
 * Every route must be either explicitly public or explicitly protected.
 *
 * The middleware used to set a request id and nothing else, so protection was
 * entirely per-handler: any future route whose handler forgot to `await auth()`
 * was silently public. This pins an explicit allowlist instead — anything not
 * named there goes through `auth.protect()`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/** Records every `auth.protect()` call the middleware makes. */
let protectedPaths: string[] = [];

vi.mock("@clerk/nextjs/server", async () => {
  const actual = await vi.importActual<typeof import("@clerk/nextjs/server")>(
    "@clerk/nextjs/server",
  );
  return {
    ...actual,
    // Run the callback immediately so the handler body executes, and record
    // whether it asked for protection.
    clerkMiddleware:
      (handler: (auth: unknown, req: unknown) => unknown) =>
      async (req: unknown) => {
        const url = new URL((req as { url: string }).url);
        return handler(
          {
            userId: "user_1",
            protect: () => {
              protectedPaths.push(url.pathname);
            },
          },
          req,
        );
      },
  };
});

import middleware from "@/proxy";

async function run(pathname: string) {
  protectedPaths = [];
  // createRouteMatcher reads `req.nextUrl`, which only NextRequest provides.
  await middleware(
    new NextRequest(`http://localhost${pathname}`) as never,
    {} as never,
  );
  return protectedPaths.includes(pathname);
}

/** Routes a signed-out visitor must be able to reach. */
const PUBLIC = [
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/forgot-password/reset-password",
  "/legal/privacy-policy",
  "/legal/terms-of-service",
  "/sso-callback",
  "/api/webhooks/clerk",
  "/api/inngest",
];

/** Routes that must never be reachable without a session. */
const PRIVATE = [
  "/dashboard",
  "/create-project",
  "/chat",
  "/chat/abc123",
  "/code-viewer",
  "/code-viewer/abc123",
  "/dashboard/user-project/abc123",
  "/api/chat",
  "/api/embeddings",
  "/api/trpc/project.getAll",
];

beforeEach(() => {
  protectedPaths = [];
});

describe("proxy route protection", () => {
  for (const path of PUBLIC) {
    it(`leaves ${path} public`, async () => {
      expect(await run(path)).toBe(false);
    });
  }

  for (const path of PRIVATE) {
    it(`protects ${path}`, async () => {
      expect(await run(path)).toBe(true);
    });
  }
});
