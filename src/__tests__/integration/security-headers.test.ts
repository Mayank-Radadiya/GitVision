import { describe, it, expect } from "vitest";
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
    expect(img).toContain("https://avatars.githubusercontent.com");
    expect(img).toContain("https://camo.githubusercontent.com");
    expect(img).toContain("https://via.placeholder.com");
  });

  it("does not relax scripts or styles beyond what the framework needs", () => {
    // The nonce and 'strict-dynamic' come from Clerk's strict mode; this app
    // must not add anything that would widen them.
    expect(CSP_DIRECTIVES["script-src"]).toBeUndefined();
    expect(CSP_DIRECTIVES["style-src"]).toBeUndefined();
  });
});
