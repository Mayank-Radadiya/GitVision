import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import nextConfig from "@/next.config";
import {
  CSP_DIRECTIVES,
  CSP_MIDDLEWARE_OPTIONS,
  stripUnsafeScriptDirectives,
} from "@/src/lib/csp";

/** Every static header `next.config.ts` promises, with the exact value it must carry. */
const EXPECTED_STATIC_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  [
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  ],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
];

async function globalHeaderMap(): Promise<Map<string, string>> {
  expect(nextConfig.headers).toBeDefined();
  if (!nextConfig.headers) throw new Error("next.config.ts defines no headers()");
  const configs = await nextConfig.headers();
  const rule = configs.find((c) => c.source === "/:path*");
  expect(rule).toBeDefined();
  return new Map(rule!.headers.map((h) => [h.key, h.value]));
}

describe("Security Headers Configuration", () => {
  it("serves every security header for all routes (/:path*) with its exact value", async () => {
    const headers = await globalHeaderMap();

    for (const [key, value] of EXPECTED_STATIC_HEADERS) {
      expect(headers.get(key), `missing header ${key}`).toBe(value);
    }
  });

  it("no longer sends the withdrawn X-XSS-Protection header", async () => {
    const headers = await globalHeaderMap();
    expect(headers.has("X-XSS-Protection")).toBe(false);
  });
});

describe("Content Security Policy hardening directives", () => {
  it("locks down the directives Clerk does not set itself", () => {
    expect(CSP_DIRECTIVES["object-src"]).toEqual(["'none'"]);
    expect(CSP_DIRECTIVES["base-uri"]).toEqual(["'self'"]);
    expect(CSP_DIRECTIVES["frame-ancestors"]).toEqual(["'none'"]);
  });

  it("keeps fonts same-origin only", () => {
    expect(CSP_DIRECTIVES["font-src"]).toEqual(["'self'"]);
  });

  it("allows the inline data URI in globals.css and the GitHub avatar hosts", () => {
    const img = CSP_DIRECTIVES["img-src"];
    expect(img).toContain("data:");
    expect(img).toContain("https://ui-avatars.com");
    expect(img).toContain("https://avatars.githubusercontent.com");
    expect(img).toContain("https://camo.githubusercontent.com");
  });

  it("no longer allowlists via.placeholder.com, which is shut down", () => {
    expect(CSP_DIRECTIVES["img-src"]).not.toContain("https://via.placeholder.com");
  });

  it("does not relax scripts or styles beyond what the framework needs", () => {
    // The nonce and 'strict-dynamic' come from Clerk's strict mode; this app
    // must not add anything that would widen them.
    expect(CSP_DIRECTIVES["script-src"]).toBeUndefined();
    expect(CSP_DIRECTIVES["style-src"]).toBeUndefined();
  });
});

describe("Content Security Policy enforcement", () => {
  it("blocks rather than only reporting", () => {
    // Clerk keys the response header off this flag: true emits
    // Content-Security-Policy-Report-Only, false emits Content-Security-Policy.
    expect(CSP_MIDDLEWARE_OPTIONS.reportOnly).toBe(false);
  });

  it("keeps strict mode on so a nonce and 'strict-dynamic' are minted", () => {
    // Without strict there is no nonce, and an enforcing policy without a nonce
    // under 'strict-dynamic' blocks every script the app emits.
    expect(CSP_MIDDLEWARE_OPTIONS.strict).toBe(true);
  });

  it("mints the policy from the same directives the hardening tests pin", () => {
    // If these drift, the browser enforces a policy nobody reviewed.
    expect(CSP_MIDDLEWARE_OPTIONS.directives).toBe(CSP_DIRECTIVES);
  });

  it("still routes violations to the collector", () => {
    // Clerk only emits `report-to csp-endpoint` when this is set, so leaving it
    // undefined would make the enforcing policy report nothing and
    // /api/csp-report dead.
    expect(CSP_MIDDLEWARE_OPTIONS.reportTo).toBe("/api/csp-report");
  });
});

/**
 * `stripUnsafeScriptDirectives`.
 *
 * The fixture is verbatim output from Clerk's own generator configured with
 * `CSP_MIDDLEWARE_OPTIONS` (captured by importing
 * `createContentSecurityPolicyHeaders` from a scratch script). It is pinned
 * here as a literal rather than generated at test time because the generator is
 * not reachable from the public export map: `@clerk/nextjs`'s `exports` has no
 * wildcard, so `import "@clerk/nextjs/dist/esm/server/content-security-policy.js"`
 * throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. Reaching into `node_modules` by file
 * URL would pin the suite to a dependency's internal build layout, so the string
 * is pinned instead and re-verified whenever Clerk is upgraded.
 */
const CLERK_POLICY =
  "base-uri 'self'; connect-src 'self' https://clerk-telemetry.com https://*.clerk-telemetry.com https://api.stripe.com https://maps.googleapis.com https://img.clerk.com https://images.clerkstage.dev https://*.protect.clerk.com app-example.clerk.accounts.dev; default-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'self' https://challenges.cloudflare.com https://*.js.stripe.com https://js.stripe.com https://hooks.stripe.com https://*.protect.clerk.com; img-src 'self' https://img.clerk.com data: https://ui-avatars.com https://avatars.githubusercontent.com https://camo.githubusercontent.com; object-src 'none'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.js.stripe.com https://js.stripe.com https://maps.googleapis.com https://*.protect.clerk.com 'strict-dynamic' 'nonce-LSoK8Dsn5iUQi0NCyjPAMg=='; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; report-to csp-endpoint";

/** The same policy with only `script-src` scrubbed. */
const SCRUBBED_POLICY = CLERK_POLICY.replace(
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' ",
  "script-src 'self' ",
);

const scriptSrc = (policy: string) =>
  policy
    .split(";")
    .find((directive) => directive.trim().startsWith("script-src"))!;

describe("stripUnsafeScriptDirectives", () => {
  it("removes both unsafe keywords from a real Clerk policy and changes nothing else", () => {
    expect(stripUnsafeScriptDirectives(CLERK_POLICY)).toBe(SCRUBBED_POLICY);
  });

  it("leaves the nonce byte-for-byte, since it is what the scripts are tagged with", () => {
    // Getting this wrong does not weaken the policy, it breaks the app: the
    // scripts carry the same nonce, so a mangled one blocks every one of them.
    expect(scriptSrc(stripUnsafeScriptDirectives(CLERK_POLICY))).toContain(
      "'nonce-LSoK8Dsn5iUQi0NCyjPAMg=='",
    );
  });

  it("keeps 'strict-dynamic', which is what makes the policy nonce-only", () => {
    expect(scriptSrc(stripUnsafeScriptDirectives(CLERK_POLICY))).toContain(
      "'strict-dynamic'",
    );
  });

  it("keeps the vendor hosts, so the scrub is not mistaken for host removal", () => {
    // Under 'strict-dynamic' a CSP3 browser ignores these anyway; removing
    // them would be a different change with its own test.
    const scrubbed = scriptSrc(stripUnsafeScriptDirectives(CLERK_POLICY));
    expect(scrubbed).toContain("https://js.stripe.com");
    expect(scrubbed).toContain("https://*.protect.clerk.com");
    expect(scrubbed).toContain("'self'");
  });

  it("never touches another directive, including style-src 'unsafe-inline'", () => {
    // style-src keeps 'unsafe-inline' on purpose: Tailwind, Next's critical CSS
    // and Shiki's inline styles cannot be pre-hashed.
    expect(stripUnsafeScriptDirectives(CLERK_POLICY)).toContain(
      "style-src 'self' 'unsafe-inline'",
    );
    for (const directive of ["connect-src", "frame-src", "img-src", "worker-src"]) {
      const before = CLERK_POLICY.split("; ").find((d) => d.startsWith(directive));
      const after = SCRUBBED_POLICY.split("; ").find((d) => d.startsWith(directive));
      expect(after, `${directive} was altered`).toBe(before);
    }
  });

  it("still strips when script-src is the only directive, and when it is last", () => {
    // The trailing `;` and the no-sibling cases exercise the anchor on either
    // side of the replacement.
    expect(stripUnsafeScriptDirectives("script-src 'self' 'unsafe-inline';")).toBe(
      "script-src 'self';",
    );
    expect(
      stripUnsafeScriptDirectives("default-src 'self'; script-src 'self' 'unsafe-eval'"),
    ).toBe("default-src 'self'; script-src 'self'");
  });

  it("returns a policy with no script-src unchanged", () => {
    const noScripts = "default-src 'self'; object-src 'none'";
    expect(stripUnsafeScriptDirectives(noScripts)).toBe(noScripts);
  });

  it("does not mistake script-src-elem for script-src", () => {
    // A substring match would strip the keyword from the wrong directive.
    const policy = "script-src-elem 'unsafe-inline'";
    expect(stripUnsafeScriptDirectives(policy)).toBe(policy);
  });
});

/**
 * The violation collector. The policy itself is now minted per request by
 * `clerkMiddleware` (see `src/lib/csp.ts`), but the endpoint that receives the
 * reports it produces is unchanged, and unauthenticated by design: a browser
 * posts on the page's behalf, so there is no session to present.
 */

vi.mock("@/src/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const { logger } = await import("@/src/lib/logger");
const { POST } = await import("@/app/api/csp-report/route");

const reportRequest = (body: unknown, contentType: string) =>
  new NextRequest("http://localhost/api/csp-report", {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.mocked(logger.warn).mockClear();
  vi.mocked(logger.error).mockClear();
});

describe("POST /api/csp-report", () => {
  it("records a legacy application/csp-report payload", async () => {
    const res = await POST(
      reportRequest(
        {
          "csp-report": {
            "document-uri": "https://gitvision.app/chat",
            "blocked-uri": "https://evil.example/track.js",
            "violated-directive": "script-src-elem",
          },
        },
        "application/csp-report",
      ),
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");

    const logged = vi.mocked(logger.warn).mock.calls.flat().join(" ");
    expect(logged).toContain("https://evil.example/track.js");
    expect(logged).toContain("script-src-elem");
  });

  it("records a Reporting API reports+json payload", async () => {
    const res = await POST(
      reportRequest(
        [
          {
            type: "csp-violation",
            body: {
              "documentURL": "https://gitvision.app/chat",
              blockedURL: "https://tracker.example/pixel",
              effectiveDirective: "img-src",
            },
          },
        ],
        "application/reports+json",
      ),
    );

    expect(res.status).toBe(204);
    expect(vi.mocked(logger.warn).mock.calls.flat().join(" ")).toContain(
      "https://tracker.example/pixel",
    );
  });

  it("refuses a body large enough to be an amplification vector", async () => {
    const huge = `{"csp-report":{"blocked-uri":"${"a".repeat(64 * 1024)}"}}`;

    const res = await POST(reportRequest(huge, "application/csp-report"));

    expect(res.status).toBe(204);
    expect(vi.mocked(logger.warn).mock.calls.flat().join(" ")).not.toContain(
      "a".repeat(100),
    );
  });

  it("never echoes the submitted body back to the caller", async () => {
    const res = await POST(
      reportRequest(
        { "csp-report": { "blocked-uri": "https://secret.example/thing" } },
        "application/csp-report",
      ),
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });
});
