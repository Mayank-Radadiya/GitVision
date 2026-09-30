import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import nextConfig from "@/next.config";
import { CSP_DIRECTIVES } from "@/src/lib/csp";

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
