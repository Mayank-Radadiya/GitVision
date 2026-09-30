import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { sanitizeForOutbound } from "@/src/lib/logger";

/**
 * F-24 — Sentry captures a lot on its own: unhandled route-handler errors, load
 * errors, React render errors, and the request metadata Sentry's `RequestData`
 * integration attaches (headers, cookies, query string, client IP). None of that
 * passes through `logger.error`, so none of it passed through the redaction
 * walker — the transport registered in sentry.server.config.ts only ever saw
 * explicit log calls.
 *
 * Decision D-4 forbids that: every event and breadcrumb sent off-box has to go
 * through the same walker stdout uses. These two tests are the check on that —
 * one on the walker's behaviour against a real Sentry event shape, one on the
 * wiring, because a correct walker behind an unwired hook redacts nothing.
 */
describe("Sentry outbound redaction (F-24)", () => {
  /** Shaped like a Sentry ErrorEvent: request metadata is the leak that matters. */
  function sentryEvent() {
    return {
      exception: {
        values: [
          {
            type: "Error",
            value: "boom",
            stacktrace: {
              frames: [
                { filename: "app/api/webhooks/github/route.ts", function: "POST" },
              ],
            },
          },
        ],
      },
      request: {
        url: "https://gitvision.dev/api/webhooks/github?token=abc123",
        method: "POST",
        headers: {
          authorization: "Bearer ghp_supersecrettoken",
          cookie: "session=abc123; other=xyz",
          "x-github-signature": "sha256=deadbeef",
          "content-type": "application/json",
        },
        cookies: { session: "abc123" },
        query_string: "token=abc123&page=2",
      },
      user: { id: "user_1", email: "someone@example.com" },
      contexts: {
        // Typed loosely so the cycle below can be attached to it.
        runtime: { name: "node" } as Record<string, unknown>,
        extra: { apiKey: "sk-live-1234", databaseUrl: "postgres://u:p@h/db" },
      },
      tags: { boundary: "route-handler" },
      extra: { credential: "vault-token-9" },
    };
  }

  it("redacts a Sentry event: denylisted keys, request metadata, and cycles", () => {
    const event = sentryEvent();
    // A self-referential context, which Sentry can produce and `redact` must not
    // choke on.
    event.contexts.runtime.self = event.contexts;

    const out = sanitizeForOutbound(event);

    // Request metadata is the real leak: this is what Sentry attaches on its own.
    expect(out.request.headers.authorization).toBe("[redacted]");
    expect(out.request.headers.cookie).toBe("[redacted]");

    // KNOWN GAP, asserted so it cannot be forgotten — see the F-24 Findings.
    // The denylist covers the `cookie` *header* but not the parsed cookies
    // object Sentry builds from it, where a Clerk session lands under the key
    // `session`. Not redacted, and not fixable inside this task: the denylist is
    // a deliberate policy list, and widening it is a separate decision. Flip
    // this to `[redacted]` the day `session` joins the list.
    expect(out.request.cookies.session).toBe("abc123");

    // A secret inside a string value is likewise not masked: the walker redacts
    // by key, not by content. `query_string` holds `token=abc123&page=2`.
    expect(out.request.query_string).toBe("token=abc123&page=2");

    // The denylist, at the depths the walker actually visits.
    expect(out.user.email).toBe("[redacted]");
    expect(out.extra.credential).toBe("[redacted]");
    expect(out.contexts.extra.apiKey).toBe("[redacted]");

    // Keys Sentry does not know about but which still carry a secret. Not on the
    // denylist, so they pass through — see the Findings in the F-24 report; the
    // documented list and the implemented list do not match.
    expect(out.contexts.extra.databaseUrl).toBe("postgres://u:p@h/db");

    // Non-secret fields survive untouched, or the event would be useless.
    expect(out.request.headers["content-type"]).toBe("application/json");
    expect(out.request.headers["x-github-signature"]).toBe("sha256=deadbeef");
    expect(out.tags.boundary).toBe("route-handler");
    expect(out.exception.values[0].stacktrace.frames[0].filename).toBe(
      "app/api/webhooks/github/route.ts",
    );

    // Cycle broken, not thrown on, and the shared parent is visited once.
    expect(out.contexts.runtime.self).toBe("[circular]");
    expect(out.contexts.runtime.name).toBe("node");

    // The event survives serialisation, which is what Sentry does next.
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it("redacts a breadcrumb payload", () => {
    const out = sanitizeForOutbound({
      category: "fetch",
      message: "POST /api/sync",
      level: "info",
      data: {
        method: "POST",
        authorization: "Bearer ghp_supersecrettoken",
        nested: { password: "hunter2", retryCount: 2 },
      },
    });

    expect(out.data.authorization).toBe("[redacted]");
    expect(out.data.nested.password).toBe("[redacted]");
    expect(out.data.nested.retryCount).toBe(2);
    expect(out.category).toBe("fetch");
  });

  it("caps depth instead of walking a deep payload forever", () => {
    // The ceiling is inherited from the stdout walker, so a Sentry event nested
    // past MAX_DEPTH reports `[circular]` where a frame's locals would be. Named
    // as a trade in the sanitizeForOutbound doc comment.
    const deep: Record<string, unknown> = {};
    let node = deep;
    for (let i = 0; i < 12; i += 1) {
      const child: Record<string, unknown> = { depth: i };
      node.next = child;
      node = child;
    }

    const out = sanitizeForOutbound(deep);
    expect(out).not.toBe(deep);
    // Somewhere below the ceiling the walk stops, and what it leaves behind is a
    // marker rather than the value — which is the point: the event is still
    // bounded, still serialisable, and no deeper secret rode along. Depth 0
    // survives; depth 11 is past MAX_DEPTH and never arrives.
    const serialised = JSON.stringify(out);
    expect(serialised).toContain('"depth":0');
    expect(serialised).toContain("[circular]");
    expect(serialised).not.toContain('"depth":11');
  });

  /**
   * A correct walker behind an unwired hook redacts nothing, so assert the
   * wiring by reading the configs. Same approach the logger suite takes for its
   * `console.*` rule: the SDK cannot be booted here without making network
   * calls, and the claim worth protecting is which hooks a config registers.
   */
  describe("wiring", () => {
    const ROOT = join(__dirname, "../../..");

    const CONFIGS = [
      "sentry.server.config.ts",
      "sentry.edge.config.ts",
      "instrumentation-client.ts",
    ] as const;

    it.each(CONFIGS)("%s gates both beforeSend and beforeBreadcrumb", (file) => {
      const source = readFileSync(join(ROOT, file), "utf8");

      expect(source).toMatch(/beforeSend:\s*sanitizeForOutbound/);
      expect(source).toMatch(/beforeBreadcrumb:\s*sanitizeForOutbound/);
      // The hook and the walker come from one place; a config that redefined the
      // walk would satisfy the two assertions above without going through
      // src/lib/logger.ts.
      expect(source).toMatch(/import \{[^}]*sanitizeForOutbound[^}]*\} from "@\/src\/lib\/logger"/);
    });

    it.each(CONFIGS)("%s reports only in production", (file) => {
      const source = readFileSync(join(ROOT, file), "utf8");
      // The gate lives in a local const in the server and edge configs and
      // inline in the client one, so assert the condition rather than its
      // placement: no runtime may report unless NODE_ENV is production.
      expect(source).toMatch(/process\.env\.NODE_ENV === "production"/);
    });

    it("reads the browser DSN from NEXT_PUBLIC_SENTRY_DSN", () => {
      // Next.js inlines only NEXT_PUBLIC_* into a client bundle, so
      // SENTRY_DSN would compile to undefined here and the client would never
      // report — silently.
      const source = readFileSync(join(ROOT, "instrumentation-client.ts"), "utf8");
      expect(source).toMatch(/NEXT_PUBLIC_SENTRY_DSN/);
      expect(source).not.toMatch(/process\.env\.SENTRY_DSN/);
    });

    it("exports onRequestError so nested server-component errors are not dropped", () => {
      // Next.js surfaces an error escaping a nested RSC only through
      // onRequestError; Sentry's build plugin warns at build time without it.
      const source = readFileSync(join(ROOT, "instrumentation.ts"), "utf8");
      expect(source).toMatch(/export const onRequestError = Sentry\.captureRequestError;/);
    });

    it("reports render errors that reach the global error boundary", () => {
      const source = readFileSync(join(ROOT, "app/global-error.tsx"), "utf8");
      expect(source).toMatch(/Sentry\.captureException/);
    });

    it("passes the source-map credentials the build plugin requires", () => {
      // canUploadSourceMaps() returns false when org, project or authToken is
      // absent, so a bare withSentryConfig never uploads anything.
      const source = readFileSync(join(ROOT, "next.config.ts"), "utf8");
      expect(source).toMatch(/org:\s*process\.env\.SENTRY_ORG/);
      expect(source).toMatch(/project:\s*process\.env\.SENTRY_PROJECT/);
      expect(source).toMatch(/authToken:\s*process\.env\.SENTRY_AUTH_TOKEN/);
    });
  });
});
