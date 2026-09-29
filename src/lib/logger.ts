export interface LogContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

/**
 * Keys whose values must never reach a log sink.
 *
 * A log record is not a private channel: it goes to the platform's log
 * aggregator, where it is retained for longer than anyone intends, visible to
 * whoever holds access to the platform, and searchable. Anything logged here
 * should be assumed to have been read by somebody. These are the nine keys
 * that carry credentials or personal data rather than diagnostic value — a
 * bearer token, a provider API key, a session cookie, or a person's email
 * address — so their values are replaced rather than trimmed.
 *
 * Keys are compared with `_` and `-` removed and case folded, so the header
 * spelling `Authorization` and the hand-written `apiKey` both resolve onto the
 * listed `authorization` and `api_key`. Removing only the separators cannot
 * create a false match: `emailCount` does not become `email`.
 */
const REDACTED_KEYS = new Set(
  [
    "token",
    "secret",
    "password",
    "passwd",
    "authorization",
    "cookie",
    "api_key",
    "email",
    "credential",
  ].map((key) => key.replace(/[-_]/g, "")),
);

const REDACTED = "[redacted]";

/**
 * How much of a `message` or `stack` is kept. Long values are the usual symptom
 * of a provider echoing a whole prompt or response body back at us; a stack past
 * this point is the same frames repeated. 2000 characters is enough to read a
 * stack's shape and far too little to carry a file.
 */
const MAX_STRING_LENGTH = 2000;

function isRedactedKey(key: string): boolean {
  return REDACTED_KEYS.has(key.toLowerCase().replace(/[-_]/g, ""));
}

function truncate(text: string, key?: string): string {
  if (key !== "message" && key !== "stack") return text;
  if (text.length <= MAX_STRING_LENGTH) return text;
  return `${text.slice(0, MAX_STRING_LENGTH)}… [truncated ${text.length - MAX_STRING_LENGTH} chars]`;
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * One pass over everything about to be logged: replace the values of
 * {@link REDACTED_KEYS} and shorten the unbounded ones. Nested objects and
 * arrays are walked because a secret arrives one level down far more often than
 * at the top. Anything that is not a plain object or array — a `Date`, a `Map`,
 * a class instance — is left to `JSON.stringify` exactly as before.
 */
function redact(value: unknown, key?: string): unknown {
  if (typeof value === "string") return truncate(value, key);
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value !== null && typeof value === "object" && isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        isRedactedKey(k) ? REDACTED : redact(v, k),
      ]),
    );
  }
  return value;
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(
      JSON.stringify(
        redact({
          timestamp: new Date().toISOString(),
          level: "INFO",
          message,
          ...context,
        }),
      ),
    );
  },

  warn(message: string, context?: LogContext) {
    console.warn(
      JSON.stringify(
        redact({
          timestamp: new Date().toISOString(),
          level: "WARN",
          message,
          ...context,
        }),
      ),
    );
  },

  error(message: string, error?: unknown, context?: LogContext) {
    console.error(
      JSON.stringify(
        redact({
          timestamp: new Date().toISOString(),
          level: "ERROR",
          message,
          // An Error's name/message/stack are not enumerable, so JSON.stringify
          // would emit `{}` without this; the result is redacted below like
          // everything else.
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : error,
          ...context,
        }),
      ),
    );
  },

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(
        JSON.stringify(
          redact({
            timestamp: new Date().toISOString(),
            level: "DEBUG",
            message,
            ...context,
          }),
        ),
      );
    }
  },
};
