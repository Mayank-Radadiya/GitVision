import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logger } from "@/src/lib/logger";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/forgot-password(.*)",
  "/legal(.*)",
  "/api/webhooks(.*)",
  "/api/inngest(.*)",
  "/sso-callback(.*)",
  "/",
]);

export default clerkMiddleware(async (auth, req) => {
  const startTime = Date.now();
  const requestId =
    req.headers.get("x-request-id") || crypto.randomUUID();

  // Create request headers with injected x-request-id
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Attach x-request-id header to response
  response.headers.set("x-request-id", requestId);

  const durationMs = Date.now() - startTime;
  logger.info(`HTTP ${req.method} ${req.nextUrl.pathname}`, {
    requestId,
    method: req.method,
    path: req.nextUrl.pathname,
    durationMs,
  });

  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
