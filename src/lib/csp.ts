import type { ClerkMiddlewareOptions } from "@clerk/nextjs/server";

/** Derived from Clerk's public option type, which does not re-export it. */
type CspDirectives = NonNullable<
  NonNullable<ClerkMiddlewareOptions["contentSecurityPolicy"]>["directives"]
>;

/**
 * Hardening directives merged into Clerk's generated policy.
 *
 * The nonce, the Clerk host allowlist and `'strict-dynamic'` are not here on
 * purpose: `clerkMiddleware({ contentSecurityPolicy: { strict: true } })`
 * derives the frontend API host from the publishable key (it is a different
 * host per environment, so it cannot be hardcoded) and publishes the nonce as
 * the `X-Nonce` request header, which is how Next.js tags its own bootstrap
 * scripts and how `DynamicClerkScripts` tags Clerk's. Everything below is what
 * Clerk does not set and this app wants anyway.
 *
 * `style-src` needs `'unsafe-inline'`: Tailwind, Next's critical CSS and
 * Shiki's per-token inline styles cannot be pre-hashed. `'unsafe-inline'` in
 * `script-src` is the opposite case — CSP3 ignores it whenever a nonce or
 * `'strict-dynamic'` is present, so it costs nothing.
 */
export const CSP_DIRECTIVES: CspDirectives = {
  // Shiki injects highlighted markup through `dangerouslySetInnerHTML`
  // (code-panel.tsx) and globals.css inlines an SVG data URI.
  "img-src": [
    "data:",
    // Fallback author avatar for commits and issues with no GitHub picture
    // (src/lib/github/constants.ts).
    "https://ui-avatars.com",
    "https://avatars.githubusercontent.com",
    "https://camo.githubusercontent.com",
  ],
  "font-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  // Mirrors the X-Frame-Options: DENY in next.config.ts, for browsers that
  // understand one and not the other.
  "frame-ancestors": ["'none'"],
};
