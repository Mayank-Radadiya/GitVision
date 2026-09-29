import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { NextConfig } from "next";
import nextConfig from "@/next.config";

/**
 * M19 part 1 — Content-Security-Policy, report-only (decision D-5).
 *
 * The report-only phase exists to answer one question before the enforcing
 * phase (T-022): which origins does this app actually reach that the policy
 * does not name? Until that has been read off a real violation report, the
 * header must never be the enforcing kind — a missing origin under
 * `Content-Security-Policy` is a white screen, not a warning.
 */

const COLLECTOR_PATH = "/api/csp-report";

type HeaderRule = { key: string; value: string };

async function globalHeaders(): Promise<HeaderRule[]> {
  const rules = (await nextConfig.headers?.()) as Awaited<
    ReturnType<NonNullable<NextConfig["headers"]>>
  >;
  const match = rules.find((rule) => rule.source === "/:path*");
  expect(match).toBeDefined();
  return match?.headers as HeaderRule[];
}

function headerValue(headers: HeaderRule[], key: string): string | undefined {
  return headers.find((h) => h.key === key)?.value;
}

/** Splits a policy into its individual directives (`"a b; c"` → `["a b", "c"]`). */
function directives(policy: string): string[] {
  return policy
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);
}

describe("Security Headers Configuration", () => {
  it("should configure security headers for all routes (/:path*)", async () => {
    expect(nextConfig.headers).toBeDefined();
    if (nextConfig.headers) {
      const headersConfig = await nextConfig.headers();
      expect(headersConfig.length).toBeGreaterThan(0);

      const globalHeaders = headersConfig.find((h) => h.source === "/:path*");
      expect(globalHeaders).toBeDefined();

      const headerKeys = globalHeaders?.headers.map((h) => h.key);
      expect(headerKeys).toContain("X-Content-Type-Options");
      expect(headerKeys).toContain("X-Frame-Options");
      expect("X-XSS-Protection").toBeDefined();
      expect(headerKeys).not.toContain("X-XSS-Protection");
      expect(headerKeys).toContain("Referrer-Policy");
      expect(headerKeys).toContain("Strict-Transport-Security");
      expect(headerKeys).toContain("Permissions-Policy");
    }
  });
});

describe("Content-Security-Policy (report-only)", () => {
  it("sends the report-only header and never the enforcing one", async () => {
    const headers = await globalHeaders();

    expect(headerValue(headers, "Content-Security-Policy-Report-Only")).toBeDefined();
    expect(headerValue(headers, "Content-Security-Policy")).toBeUndefined();
  });

  it("pins the directives that have no safe lax value", async () => {
    const policy = headerValue(await globalHeaders(), "Content-Security-Policy-Report-Only") ?? "";
    const list = directives(policy);

    expect(list).toContain("default-src 'self'");
    expect(list).toContain("object-src 'none'");
    expect(list).toContain("frame-ancestors 'none'");
    expect(list).toContain("base-uri 'self'");
    expect(list).toContain("form-action 'self'");
  });

  it("enumerates the third-party origins the app genuinely reaches", async () => {
    const policy = headerValue(await globalHeaders(), "Content-Security-Policy-Report-Only") ?? "";
    const list = directives(policy).join("\n");

    // Clerk: widgets, avatars, session polling (script/img/connect/frame).
    expect(list).toContain("https://*.clerk.com");
    expect(list).toContain("https://img.clerk.com");
    // GitHub avatar proxies configured in next.config.ts `images.remotePatterns`.
    expect(list).toContain("https://avatars.githubusercontent.com");
    expect(list).toContain("https://camo.githubusercontent.com");
    expect(list).toContain("https://ui-avatars.com");
    // Inngest: the dev server runs on its own port, the cloud product on a
    // subdomain, and both stream over a websocket.
    expect(list).toContain("https://*.inngest.app");
    expect(list).toMatch(/wss:\/\/\*\.inngest\.app/);
    expect(list).toContain("http://localhost:8288");
    // Vercel: deployment metadata plus the dev overlay's websocket.
    expect(list).toContain("https://*.vercel.com");
  });

  it("points the policy at the collector endpoint", async () => {
    const policy = headerValue(await globalHeaders(), "Content-Security-Policy-Report-Only") ?? "";
    const list = directives(policy);

    expect(list).toContain(`report-uri ${COLLECTOR_PATH}`);
    expect(list).toContain("report-to csp-endpoint");
  });

  it("declares the reporting endpoints under the name the policy references", async () => {
    const headers = await globalHeaders();

    expect(headerValue(headers, "Reporting-Endpoints")).toContain(
      `csp-endpoint="${COLLECTOR_PATH}"`,
    );

    const reportTo = headerValue(headers, "Report-To") ?? "";
    expect(JSON.parse(reportTo).group).toBe("csp-endpoint");
    expect(JSON.parse(reportTo).endpoints[0].url).toBe(COLLECTOR_PATH);
  });
});

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
    expect(vi.mocked(logger.warn).mock.calls.flat().join(" ")).not.toContain("a".repeat(100));
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
