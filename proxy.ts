import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * The complete set of routes a signed-out visitor may reach.
 *
 * Protection used to live entirely inside each handler, which meant a new route
 * whose handler forgot to `await auth()` was silently public. Declaring the
 * public surface here inverts that: a route is private unless it is named below.
 * Adding a page means adding it to this list, and adding a list entry is a
 * visible diff someone can review.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Password reset has to work for people who are, by definition, signed out.
  "/forgot-password(.*)",
  "/legal(.*)",
  "/sso-callback",
  // Clerk's webhook is called without a session and is authenticated by its own
  // signature check; Inngest likewise signs its requests.
  "/api/webhooks/clerk",
  "/api/inngest(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const requestId =
    req.headers.get("x-request-id") || crypto.randomUUID();

  req.headers.set("x-request-id", requestId);

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
