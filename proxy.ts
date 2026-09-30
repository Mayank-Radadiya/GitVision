import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import {
  CSP_MIDDLEWARE_OPTIONS,
  stripUnsafeScriptDirectives,
} from "@/src/lib/csp";

/**
 * The complete set of routes a signed-out visitor may reach.
 *
 * Protection used to live entirely inside each handler, which meant a new route
 * whose handler forgot to `await auth()` was silently public. Declaring the
 * public surface here inverts that: a route is private unless it is named below.
 * Adding a page means adding it to this list, and adding a list entry is a
 * visible diff someone can review.
 */
const PUBLIC_ROUTE_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  // Password reset has to work for people who are, by definition, signed out.
  /^\/forgot-password(\/.*)?$/,
  /^\/legal(\/.*)?$/,
  /^\/sso-callback\/?$/,
  // Clerk's webhook is called without a session and is authenticated by its own
  // signature check; Inngest likewise signs its requests.
  /^\/api\/webhooks\/clerk\/?$/,
  /^\/api\/inngest(\/.*)?$/,
  // CSP violation reports are posted by the browser on the page's behalf, so
  // there is no session to present. The collector is unauthenticated by
  // design: it reads a bounded body, writes a log line, and returns 204.
  /^\/api\/csp-report\/?$/,
  // An uptime monitor has no session. The handler is read-only and returns no
  // customer data — see the "signed-out reachability" test.
  /^\/api\/health\/?$/,
  // The landing page's public counters (F-05) are aggregate `COUNT(*)`s that
  // name no user and no repository, but the hero fetches them from the browser
  // so they hydrate rather than arriving pre-rendered. Narrow to this one
  // procedure, never `/api/trpc` as a whole: a wildcard here would silently
  // publish every other procedure to signed-out callers the day one is added.
  /^\/api\/trpc\/project\.getPublicStats\/?$/,
];

function isPublicRoute(req: { nextUrl?: { pathname: string }; url?: string }): boolean {
  const pathname =
    req.nextUrl?.pathname ??
    (req.url ? new URL(req.url, "http://localhost").pathname : "");
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

const withCsp = clerkMiddleware(
  async (auth, req) => {
    const requestId =
      req.headers.get("x-request-id") || crypto.randomUUID();

    req.headers.set("x-request-id", requestId);

    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  },
  {
    // A nonce-based policy has to be minted per request, which means it cannot
    // live in next.config.ts — that only produces static header values. Clerk
    // mints the nonce, adds the frontend API host (a different domain in every
    // environment) and writes the policy to the response; the `X-Nonce` request
    // header is what the root layout reads to attach it to the scripts it emits.
    contentSecurityPolicy: CSP_MIDDLEWARE_OPTIONS,
  },
);

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  const result = await withCsp(req, event);

  // `clerkMiddleware` writes the policy onto the response *after* the handler
  // above returns, so the only place to reach it is here. See
  // `stripUnsafeScriptDirectives` for why the two unsafe script keywords cannot
  // be configured away instead.
  if (result instanceof Response) {
    const policy = result.headers.get("content-security-policy");
    if (policy) {
      result.headers.set(
        "content-security-policy",
        stripUnsafeScriptDirectives(policy),
      );
    }
  }

  return result;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
