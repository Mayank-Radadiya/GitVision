import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { CSP_DIRECTIVES } from "@/src/lib/csp";

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

export default clerkMiddleware(
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
    // environment) and writes the policy to both the request and the response;
    // the `X-Nonce` request header is what Next.js and Clerk's own script tag
    // read to attach it to the scripts they emit.
    //
    // Report-only, deliberately. Two script tags still carry no nonce:
    //   1. Clerk's own `clerk.browser.js`, because `DynamicClerkScripts` did not
    //      receive the nonce.
    //   2. The inline `next-themes` colour-scheme script in the root layout.
    // Under `strict-dynamic` a CSP3 browser ignores `'self'` and runs only
    // nonced scripts, so enforcing today would block both — leaving the page
    // unhydrated and authentication broken. Report-only collects the real
    // violations first. Flip `reportOnly` to false once both tags are nonced.
    contentSecurityPolicy: {
      strict: true,
      reportOnly: true,
      directives: CSP_DIRECTIVES,
    },
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
