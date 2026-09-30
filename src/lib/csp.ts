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

/**
 * The policy `clerkMiddleware` mints, kept beside the directives it merges so
 * both are assertable without booting a server.
 *
 * `reportOnly: false` is what makes the browser block rather than merely log.
 * It is safe only because every script the app emits is nonced: `clerkMiddleware`
 * publishes the nonce as the `X-Nonce` request header, `app/layout.tsx` reads it
 * and passes it down to `ClerkProvider` and `ThemeProvider`. Under
 * `'strict-dynamic'` a CSP3 browser ignores `'self'` and `'unsafe-inline'` and
 * runs only nonced scripts, so an un-nonced tag is an unhydrated page and a
 * broken sign-in, not a console warning.
 *
 * The origin list is not written out here. Clerk's generator seeds
 * `script-src`/`connect-src`/`frame-src` from `DEFAULT_DIRECTIVES` and adds the
 * frontend API host derived from the publishable key, which differs per
 * environment — see the note above on `CSP_DIRECTIVES`.
 */
export const CSP_MIDDLEWARE_OPTIONS = {
  strict: true,
  reportOnly: false,
  // Without this the policy carries no reporting directive at all and the
  // collector is dead: Clerk only appends `report-to csp-endpoint` plus the
  // matching `Reporting-Endpoints` header when `reportTo` is set. Promoting the
  // policy to enforcing does not preserve reporting on its own — a blocked
  // script is reported only because the browser still knows where to send it.
  reportTo: "/api/csp-report",
  directives: CSP_DIRECTIVES,
} satisfies NonNullable<ClerkMiddlewareOptions["contentSecurityPolicy"]>;

const UNSAFE_SCRIPT_SOURCES = new Set(["'unsafe-inline'", "'unsafe-eval'"]);

/**
 * Drop `'unsafe-inline'` and `'unsafe-eval'` from `script-src` in a policy
 * `clerkMiddleware` has already built.
 *
 * Configuration alone cannot do this. Clerk's `strict: true` only deletes the
 * bare `http:`/`https:` scheme sources and adds `'strict-dynamic'` plus the
 * nonce; the two unsafe keywords survive. And its `directives` option *unions*
 * into `DEFAULT_DIRECTIVES` (`handleExistingDirective`), so no configuration
 * value can subtract one. The header is also written after our middleware
 * handler returns, via `setHeader` on the response object, so the handler
 * cannot post-process it either. Owning the default export and rewriting the
 * header on the way out is the only seam.
 *
 * They are inert here — CSP3 ignores both whenever a nonce or
 * `'strict-dynamic'` is present — so this is about the policy reading as what
 * it actually enforces. `style-src` keeps `'unsafe-inline'` on purpose; see
 * the note on `CSP_DIRECTIVES`.
 *
 * `ponytail:` a text scrub, correct only because Clerk is the sole producer of
 * this header. If a second CSP writer ever appears, this has to become a real
 * policy builder rather than a rewrite.
 */
export function stripUnsafeScriptDirectives(policy: string): string {
  return policy.replace(
    /(^|;)([ \t]*script-src[ \t]+)([^;]*)/,
    (_directive, lead: string, name: string, sources: string) =>
      lead +
      name +
      sources
        .split(/[ \t]+/)
        .filter((source) => source !== "" && !UNSAFE_SCRIPT_SOURCES.has(source))
        .join(" "),
  );
}
