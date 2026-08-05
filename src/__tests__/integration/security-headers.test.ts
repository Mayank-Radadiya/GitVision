import { describe, it, expect } from "vitest";
import nextConfig from "@/next.config";

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
      expect(headerKeys).toContain("X-XSS-Protection");
      expect(headerKeys).toContain("Referrer-Policy");
      expect(headerKeys).toContain("Strict-Transport-Security");
      expect(headerKeys).toContain("Permissions-Policy");
    }
  });
});
