import { describe, it, expect, vi } from "vitest";
import { logger, type LogContext } from "@/src/lib/logger";

/**
 * M20 — the logger used to be the last place a secret could hide: it serialised
 * whatever it was handed, so `logger.error("Chat API error", error)` printed the
 * provider's response body and `logger.info("sync", { token })` printed the
 * token. Redaction has to live here rather than at the call sites, because there
 * are hundreds of call sites and one logger.
 */
describe("Logger Service", () => {
  const LEVELS = ["info", "warn", "error", "debug"] as const;
  type Level = (typeof LEVELS)[number];

  /** Console method each level writes through — `info` logs to `console.log`. */
  const CONSOLE_METHOD: Record<Level, "log" | "warn" | "error" | "debug"> = {
    info: "log",
    warn: "warn",
    error: "error",
    debug: "debug",
  };

  /**
   * Log at `level` with the console method stubbed, then return the single JSON
   * object that was written. The logger emits exactly one `JSON.stringify` per
   * call, so the first argument of the first call is the whole record.
   */
  function capture(
    level: Level,
    message: string,
    context?: LogContext,
    error?: unknown,
  ): Record<string, unknown> {
    const spy = vi
      .spyOn(console, CONSOLE_METHOD[level])
      .mockImplementation(() => {});
    try {
      if (level === "error") {
        logger.error(message, error, context);
      } else {
        logger[level](message, context);
      }
      expect(spy).toHaveBeenCalledTimes(1);
      return JSON.parse(String(spy.mock.calls[0][0])) as Record<string, unknown>;
    } finally {
      spy.mockRestore();
    }
  }

  /**
   * A value per denylisted key, plus the spellings that matter in practice: an
   * HTTP header arrives capitalised, and a hand-written context object spells
   * the API key `apiKey`.
   */
  const SECRETS: LogContext = {
    token: "tok_live_51H8xqz",
    secret: "sk-proj-6f1c0a9e",
    password: "correct-horse-battery-staple",
    authorization: "Bearer eyJhbGciOiJIUzI1NiJ9",
    cookie: "__session=9f2b7c1d",
    api_key: "AIzaSyA1B2C3D4E5F6",
    email: "ada@example.com",
    Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9",
    apiKey: "AIzaSyA1B2C3D4E5F6",
  };

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

  it("masks a denylisted key and never prints its value, at every level", () => {
    for (const level of LEVELS) {
      const record = capture(level, "syncing repository", SECRETS);
      const line = JSON.stringify(record);

      for (const value of Object.values(SECRETS)) {
        expect(line, `${level} leaked ${value}`).not.toContain(value);
      }
      expect(record.token).toBe("[redacted]");
    }
  });

  it("masks denylisted keys nested anywhere in the context", () => {
    const record = capture("info", "provider call", {
      user: { id: "user_1", email: "ada@example.com" },
      headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9", accept: "json" },
      attempts: [{ secret: "sk-proj-6f1c0a9e" }, { secret: "sk-proj-bad" }],
    });

    const user = record.user as Record<string, unknown>;
    const headers = record.headers as Record<string, unknown>;
    const attempts = record.attempts as Record<string, unknown>[];

    expect(user.email).toBe("[redacted]");
    expect(headers.Authorization).toBe("[redacted]");
    expect(headers.accept).toBe("json");
    expect(attempts.map((a) => a.secret)).toEqual(["[redacted]", "[redacted]"]);
    expect(JSON.stringify(record)).not.toContain("ada@example.com");
  });

  it("masks denylisted keys on the error argument, not just the context", () => {
    const record = capture("error", "chat provider failed", undefined, {
      status: 401,
      token: "tok_live_51H8xqz",
      body: { apiKey: "AIzaSyA1B2C3D4E5F6" },
    });

    const error = record.error as Record<string, unknown>;
    const body = error.body as Record<string, unknown>;

    expect(error.status).toBe(401);
    expect(error.token).toBe("[redacted]");
    expect(body.apiKey).toBe("[redacted]");
    expect(JSON.stringify(record)).not.toContain("tok_live_51H8xqz");
  });

  it("truncates an over-long message instead of logging all of it", () => {
    const record = capture("info", "x".repeat(5000));

    const message = String(record.message);
    expect(message.length).toBeLessThan(5000);
    expect(message.startsWith("x")).toBe(true);
    expect(message).toContain("truncated");
  });

  it("truncates an over-long error stack", () => {
    const err = new Error("provider call failed");
    err.stack = "s".repeat(5000);

    const record = capture("error", "chat provider failed", undefined, err);
    const error = record.error as Record<string, unknown>;

    expect(error.name).toBe("Error");
    expect(String(error.stack).length).toBeLessThan(5000);
    expect(String(error.stack)).toContain("truncated");
  });

  it("leaves a normal message and its ordinary context untouched", () => {
    const record = capture("info", "Deploy finished", {
      requestId: "req_1",
      statusCode: 200,
      durationMs: 12,
    });

    expect(record.message).toBe("Deploy finished");
    expect(record.level).toBe("INFO");
    expect(record.requestId).toBe("req_1");
    expect(record.statusCode).toBe(200);
    expect(record.durationMs).toBe(12);
    expect(String(record.timestamp)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
