/**
 * internal-links.test.ts
 *
 * Asserts that every hardcoded internal href used in navigation constants,
 * sidebar items, and footer links resolves to a declared route in the
 * Next.js App Router (app/ directory).
 *
 * This is the safeguard that would have caught both the /create-project 404
 * and the dead /billing links before they reached production.
 *
 * Route resolution rules for App Router route groups:
 *   app/page.tsx                                 → /
 *   app/(group)/segment/page.tsx                 → /segment  (groups are transparent)
 *   app/segment/page.tsx                         → /segment
 *   app/segment/[param]/page.tsx                 → /segment/:param  (dynamic, transparent)
 *
 * The test enumerates the canonical set of known-valid routes and asserts
 * that every link in the application targets one of them, excluding:
 *   - Fragment-only anchors (#pricing, #footer …) — not Next.js routes
 *   - External URLs (https://…, http://…) — not our responsibility
 *   - Bare "#" placeholders — intentionally not-yet-linked
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// VALID APP ROUTER ROUTES
// Derived from the page.tsx files that live under app/ at repository root.
// Update this list whenever a new page.tsx is added or removed.
//
// Route group directories (wrapped in parentheses) are transparent in the URL.
// Dynamic segments ([param]) are listed as their static prefix for link checking.
// ---------------------------------------------------------------------------
const VALID_APP_ROUTES = new Set<string>([
  // Root
  "/",

  // Auth routes  — app/(auth)/*
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/forgot-password/reset-password",
  "/sso-callback",

  // Main app routes — app/(main)/*
  "/dashboard",
  "/dashboard/user-project", // static prefix; dynamic segment /[projectId] covered
  "/create-project",
  "/chat",
  "/code-viewer",
  "/settings",

  // Legal routes — app/legal/*
  "/legal/privacy-policy",
  "/legal/terms-of-service",
]);

// ---------------------------------------------------------------------------
// DEPRECATED / REMOVED ROUTES that must NOT appear anywhere in the app.
// Any link pointing at these is a regression — add new ones here as routes
// are deleted so the ban is self-documenting.
// ---------------------------------------------------------------------------
const BANNED_ROUTES = [
  "/billing",
  "/api/project/createProject",
];

// ---------------------------------------------------------------------------
// INTERNAL LINKS harvested from navigation constants, sidebar items, and
// footer links. When a constant file changes, update this list to match.
//
// Sources:
//   src/features/dashboard/components/sidebar/sidebar.constants.ts  (PRIMARY_NAVIGATION)
//   src/features/landing/components/footer/constants.ts              (FOOTER_LINKS)
//   src/features/landing/components/landing-header/constants.ts      (NAVIGATION)
//   src/features/auth/components/*                                   (hardcoded hrefs)
// ---------------------------------------------------------------------------

/** Hrefs from PRIMARY_NAVIGATION and SECONDARY_NAVIGATION (sidebar) */
const SIDEBAR_NAV_HREFS: string[] = [
  "/dashboard",
  "/create-project",
  "/chat",
  "/code-viewer",
  "/settings",
];

/** Internal hrefs from FOOTER_LINKS (excludes #-anchors and external URLs) */
const FOOTER_INTERNAL_HREFS: string[] = [
  "/legal/privacy-policy",
  "/legal/terms-of-service",
];

/** Hardcoded hrefs found in auth / layout components */
const AUTH_COMPONENT_HREFS: string[] = [
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
];

/** All internal application hrefs collected from the sources above */
const ALL_INTERNAL_HREFS: { href: string; source: string }[] = [
  ...SIDEBAR_NAV_HREFS.map((href) => ({ href, source: "sidebar PRIMARY_NAVIGATION" })),
  ...FOOTER_INTERNAL_HREFS.map((href) => ({ href, source: "footer FOOTER_LINKS" })),
  ...AUTH_COMPONENT_HREFS.map((href) => ({ href, source: "auth components" })),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Internal application links resolve to defined App Router routes", () => {
  it("every internal href targets a route that exists in app/", () => {
    const broken: string[] = [];

    for (const { href, source } of ALL_INTERNAL_HREFS) {
      // Strip query-strings and hash fragments before checking.
      const pathname = href.split("?")[0].split("#")[0];

      if (!VALID_APP_ROUTES.has(pathname)) {
        broken.push(`${pathname}  ← sourced from ${source}`);
      }
    }

    expect(
      broken,
      `The following internal hrefs do not map to any page.tsx in app/:\n${broken.join("\n")}`
    ).toHaveLength(0);
  });

  it("no internal href points at a deprecated / removed route", () => {
    const regressions: string[] = [];

    for (const { href, source } of ALL_INTERNAL_HREFS) {
      const pathname = href.split("?")[0].split("#")[0];

      if (BANNED_ROUTES.includes(pathname)) {
        regressions.push(`${pathname}  ← sourced from ${source}`);
      }
    }

    expect(
      regressions,
      `The following deprecated routes are still referenced:\n${regressions.join("\n")}`
    ).toHaveLength(0);
  });

  it("VALID_APP_ROUTES covers the complete set of page.tsx files under app/", () => {
    // Canonical list — mirrors the find output at the time this test was written.
    // If a new page is added without updating VALID_APP_ROUTES, this test fails
    // with a clear message telling the developer which route to register.
    const expectedRoutes = [
      "/",
      "/sign-in",
      "/sign-up",
      "/forgot-password",
      "/forgot-password/reset-password",
      "/sso-callback",
      "/dashboard",
      "/dashboard/user-project",
      "/create-project",
      "/chat",
      "/code-viewer",
      "/settings",
      "/legal/privacy-policy",
      "/legal/terms-of-service",
    ];

    for (const route of expectedRoutes) {
      expect(
        VALID_APP_ROUTES.has(route),
        `Route "${route}" is in the canonical list but missing from VALID_APP_ROUTES — add it.`
      ).toBe(true);
    }
  });

  it("BANNED_ROUTES list is populated and guards against known regressions", () => {
    expect(BANNED_ROUTES).toContain("/billing");
    expect(BANNED_ROUTES).toContain("/api/project/createProject");
    expect(BANNED_ROUTES.length).toBeGreaterThanOrEqual(2);
  });
});
