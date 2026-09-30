/**
 * T-057 — the metered endpoints are limited per user only, so a fresh Clerk
 * account resets the whole budget and signup churn buys unlimited LLM and
 * GitHub spend. `enforceLimits` adds an IP dimension and a global daily
 * ceiling on top of the user-scoped check.
 *
 * The store is a Neon upsert, so these tests exercise the real SQL shape
 * through a recording stub rather than mocking `rateLimit` away — the whole
 * point of the change is *which* keys get counted, and a mock of the thing
 * under test would prove nothing.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/** Counts per limit key, so a test can exhaust one dimension and not another. */
const { counts, calls } = vi.hoisted(() => ({
  counts: new Map<string, number>(),
  calls: [] as string[],
}));

vi.mock("@/db", () => ({
  // The module imports the *neon client* tagged as `sql`, so the stub has to
  // behave like a tagged template. The first interpolated value is always the
  // limit key.
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const key = String(values[0]);
    calls.push(key);
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return Promise.resolve([{ count: next }]);
  },
}));

import { enforceLimits, clientIp, LIMITS, DAILY_CEILING } from "@/src/lib/rate-limit";

/** A request carrying the headers a real edge proxy would have set. */
const request = (headers: Record<string, string>) =>
  new Request("http://localhost/api/trpc/project.create", { headers });

const USER = "user_1";
const IP = "203.0.113.7";

beforeEach(() => {
  counts.clear();
  calls.length = 0;
});

describe("clientIp", () => {
  it("prefers the header Vercel overwrites over the client-supplied one", () => {
    // A client can send `x-forwarded-for` itself. Vercel replaces
    // `x-vercel-forwarded-for` on every request, so that value is the only one
    // here that cannot be chosen by the caller.
    const req = request({
      "x-forwarded-for": "1.2.3.4",
      "x-vercel-forwarded-for": IP,
    });

    expect(clientIp(req)).toBe(IP);
  });

  it("reads the last x-forwarded-for hop, not the first", () => {
    // `x-forwarded-for` is append-only: whatever the client sent is still at
    // the front of the list, so the first entry is attacker-chosen. Only the
    // trailing entries were appended by proxies we control.
    const req = request({ "x-forwarded-for": `1.2.3.4, 5.6.7.8, ${IP}` });

    expect(clientIp(req)).toBe(IP);
  });

  it("falls back to cf-connecting-ip when the platform header is Cloudflare", () => {
    const req = request({ "cf-connecting-ip": IP });

    expect(clientIp(req)).toBe(IP);
  });

  it("unwraps the bracketed form an IPv6 hop arrives in", () => {
    const req = request({ "x-forwarded-for": "2001:db8::1" });
    const bracketed = request({ "x-forwarded-for": "[2001:db8::1]" });

    expect(clientIp(req)).toBe("2001:db8::1");
    expect(clientIp(bracketed)).toBe("2001:db8::1");
  });

  it("refuses a value that is not IP-shaped", () => {
    // The key lands in a varchar(255) primary key, and on the fallback path it
    // is attacker-influenced. An unbounded string would be a write amplifier
    // and could not be used to group a real client.
    // A client that prepends junk to `x-forwarded-for` is ignored: the junk is
    // the caller's own value and we read the trailing hop.
    expect(clientIp(request({ "x-forwarded-for": `${"a".repeat(2000)}, ${IP}` }))).toBe(IP);
    // With no platform header in front, the whole value is the caller's, so an
    // unbounded one has to be refused rather than used as a key.
    expect(clientIp(request({ "x-forwarded-for": "a".repeat(2000) }))).toBeNull();
    expect(clientIp(request({ "x-vercel-forwarded-for": "not an ip" }))).toBeNull();
    expect(clientIp(request({ "x-vercel-forwarded-for": "203.0.113.7:443" }))).toBe("203.0.113.7");
  });

  it("returns null when there is no request, as in a server-side caller", () => {
    expect(clientIp(undefined)).toBeNull();
    expect(clientIp(null)).toBeNull();
    expect(clientIp(request({}))).toBeNull();
  });
});

describe("enforceLimits", () => {
  it("counts the user dimension first", async () => {
    const result = await enforceLimits("chat", USER, request({ "x-vercel-forwarded-for": IP }));

    expect(result.allowed).toBe(true);
    expect(calls[0]).toBe("chat:u:user_1");
  });

  it("rejects on the user dimension without spending an IP or daily write", async () => {
    counts.set("chat:u:user_1", 20); // the user limit is 20/min

    const result = await enforceLimits("chat", USER, request({ "x-vercel-forwarded-for": IP }));

    expect(result.allowed).toBe(false);
    expect(result.scope).toBe("user");
    // Failing fast on the cheap dimension is also the point: a user who is
    // already over their own budget does not get to spend three more writes.
    expect(calls).toEqual(["chat:u:user_1"]);
  });

  it("rejects on the IP dimension once many accounts share one address", async () => {
    const req = request({ "x-vercel-forwarded-for": IP });
    const ceiling = LIMITS.chat.ip.limit;
    // One call per brand-new Clerk account, which is exactly the churn the
    // user-scoped dimension cannot see: every account is on its first request
    // and therefore comfortably inside its own budget.
    for (let account = 0; account < ceiling; account++) {
      const result = await enforceLimits("chat", `fresh_account_${account}`, req);
      expect(result.allowed).toBe(true);
    }

    const result = await enforceLimits("chat", "one_account_too_many", req);

    expect(result.allowed).toBe(false);
    expect(result.scope).toBe("ip");
    // Every account that shared the address counted against the same key,
    // which is the entire reason the dimension exists.
    expect(calls.filter((key) => key === `chat:i:${IP}`)).toHaveLength(ceiling + 1);
  });

  it("rejects on the daily ceiling when no single subject is over", async () => {
    const req = request({ "x-vercel-forwarded-for": IP });
    counts.set("metered:daily", DAILY_CEILING.limit);

    const result = await enforceLimits("summary", USER, req);

    expect(result.allowed).toBe(false);
    expect(result.scope).toBe("daily");
  });

  it("shares one daily counter across every metered scope", async () => {
    const req = request({ "x-vercel-forwarded-for": IP });
    await enforceLimits("chat", USER, req);
    await enforceLimits("summary", USER, req);
    await enforceLimits("projectCreate", USER, req);

    expect(calls.filter((key) => key === "metered:daily")).toHaveLength(3);
  });

  it("skips the IP dimension when the request carries no usable address", async () => {
    // A server-side `caller` has no request at all. Bucketing every such call
    // under one placeholder address would let an unauthenticated path exhaust
    // a shared counter, so the dimension is simply absent.
    const result = await enforceLimits("chat", USER, undefined);

    expect(result.allowed).toBe(true);
    expect(calls.some((key) => key.startsWith("chat:i:"))).toBe(false);
  });

  it("keeps the user and IP keys distinct for the same subject", async () => {
    await enforceLimits("chat", USER, request({ "x-vercel-forwarded-for": IP }));

    expect(calls[0]).not.toBe(calls[1]);
  });

  it("names the binding dimension in the result", async () => {
    const req = request({ "x-vercel-forwarded-for": IP });
    const result = await enforceLimits("chat", USER, req);

    // The caller shows a different message per limit, and it needs to know
    // which one it hit without re-deriving it.
    expect(["user", "ip", "daily"]).toContain(result.scope);
  });
});

describe("limit table", () => {
  it("sets every IP limit above the user limit for the same scope", () => {
    // A shared office, a university, a mobile carrier: many real users behind
    // one address. If the IP ceiling were the tighter of the two, the people
    // sharing it would throttle each other and the user limit would be dead
    // code.
    for (const [scope, rule] of Object.entries(LIMITS)) {
      expect(rule.ip.limit, `${scope} ip limit`).toBeGreaterThan(rule.user.limit);
      expect(rule.ip.windowSeconds, `${scope} ip window`).toBeGreaterThanOrEqual(
        rule.user.windowSeconds,
      );
    }
  });

  it("covers every metered scope the routers and routes actually call", () => {
    // project.ts: create, generateAiSummary, syncIssues.
    // app/api/chat/route.ts: chat. app/api/embeddings/route.ts: embeddings
    // (POST + DELETE) and embeddingsRead (GET).
    expect(Object.keys(LIMITS).sort()).toEqual([
      "chat",
      "embeddings",
      "embeddingsRead",
      "issuesSync",
      "projectCreate",
      "summary",
    ]);
  });
});
