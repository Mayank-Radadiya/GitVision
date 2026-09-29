import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "@/src/lib/logger";

function capture(spy: "log" | "warn" | "error" | "debug") {
  const consoleSpy = vi.spyOn(console, spy).mockImplementation(() => {});
  return {
    entries: () =>
      consoleSpy.mock.calls.map(([line]) => JSON.parse(line as string)),
    output: () => consoleSpy.mock.calls.map(([line]) => String(line)).join("\n"),
    restore: () => consoleSpy.mockRestore(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Logger Service", () => {
  it("should output structured info log without throwing", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("Test log message", { key: "value" });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should output structured error log without throwing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("Test error message", { error: "something failed" });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("Logger redaction", () => {
  it("masks a denylisted key in the context at every level", () => {
    const spies = [
      capture("log"),
      capture("warn"),
      capture("error"),
      capture("debug"),
    ];

    logger.info("m", { token: "super-secret-token" });
    logger.warn("m", { password: "hunter2" });
    logger.error("m", undefined, { api_key: "sk-live-123" });
    logger.debug("m", { authorization: "Bearer abc.def" });

    for (const spy of spies) {
      const text = spy.output();
      expect(text).not.toContain("super-secret-token");
      expect(text).not.toContain("hunter2");
      expect(text).not.toContain("sk-live-123");
      expect(text).not.toContain("Bearer abc.def");
      expect(text).toContain("REDACTED");
      spy.restore();
    }
  });

  it("scrubs denylisted keys nested inside the context", () => {
    const spy = capture("log");
    logger.info("m", {
      request: {
        headers: { cookie: "session=abc", "x-forwarded-for": "1.2.3.4" },
        user: { email: "someone@example.com", id: "user-1" },
        secrets: [{ secret: "nested-secret" }],
      },
    });

    const text = spy.output();
    expect(text).not.toContain("session=abc");
    expect(text).not.toContain("someone@example.com");
    expect(text).not.toContain("nested-secret");
    expect(spy.entries()[0].request.user.id).toBe("user-1");
    expect(spy.entries()[0].request.headers["x-forwarded-for"]).toBe("1.2.3.4");
    spy.restore();
  });

  it("redacts denylisted keys carried by a logged error object", () => {
    const spy = capture("error");
    logger.error("Chat API error", {
      status: 401,
      request: { headers: { authorization: "Bearer leaked" } },
    });

    const text = spy.output();
    expect(text).not.toContain("Bearer leaked");
    expect(spy.entries()[0].error.status).toBe(401);
    spy.restore();
  });

  it("truncates an over-long message and stack", () => {
    const spy = capture("error");
    logger.error("x".repeat(10_000), new Error("y".repeat(10_000)));

    const entry = spy.entries()[0];
    expect((entry.message as string).length).toBeLessThan(10_000);
    expect(entry.message as string).toContain("[truncated 8000 chars]");
    expect((entry.error.message as string).length).toBeLessThan(10_000);
    expect((entry.error.stack as string).length).toBeLessThan(10_000);
    spy.restore();
  });

  it("leaves a normal message untouched", () => {
    const spy = capture("log");
    logger.info("Project imported", { projectId: "p-1", durationMs: 12 });

    const entry = spy.entries()[0];
    expect(entry.message).toBe("Project imported");
    expect(entry.projectId).toBe("p-1");
    expect(entry.durationMs).toBe(12);
    expect(entry.level).toBe("INFO");
    expect(spy.output()).not.toContain("REDACTED");
    spy.restore();
  });
});
