export interface LogContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

// The threat: the console is a console today, but the moment an aggregator or
// error-tracking transport is attached (see T-020) everything printed here lands
// in a third-party index. `logger.error("Chat API error", error)` hands us
// whatever an upstream provider returned, which routinely carries bearer tokens,
// cookies, API keys, email addresses and prompt content. Redacting here — in one
// place, inside the logger, instead of at ~every call site — is what makes it
// impossible to forget.
const REDACTED_KEY_PATTERN =
  /(^|_|\b)(token|secret|password|passwd|authorization|cookie|api_?key|email|credential)s?(\b|_|$)/i;
const REDACTED = "[REDACTED]";

// Long single strings are how a whole prompt or an entire provider error body
// ends up in a log line. Keep the useful head, drop the rest.
const MAX_STRING_LENGTH = 2_000;
const MAX_DEPTH = 8;

function truncate(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}… [truncated ${
        value.length - MAX_STRING_LENGTH
      } chars]`
    : value;
}

function isDenylistedKey(key: string): boolean {
  return REDACTED_KEY_PATTERN.test(key);
}

function redact(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return truncate(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[TRUNCATED_DEPTH]";

  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      isDenylistedKey(key) ? REDACTED : redact(entry, depth + 1),
    ]),
  );
}

function serialize(
  level: string,
  message: string,
  extra?: Record<string, unknown>,
): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message: truncate(message),
    ...(extra ? (redact(extra) as Record<string, unknown>) : {}),
  });
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(serialize("INFO", message, context));
  },

  warn(message: string, context?: LogContext) {
    console.warn(serialize("WARN", message, context));
  },

  error(message: string, error?: unknown, context?: LogContext) {
    console.error(
      serialize("ERROR", message, {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
        ...context,
      }),
    );
  },

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(serialize("DEBUG", message, context));
    }
  },
};
