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

const CIRCULAR = "[circular]";

/**
 * How deep the walk goes before it gives up.
 *
 * A payload that nests further than this is a structure nobody is reading; the
 * alternative — walking it whole — is unbounded work on the error path, which
 * is the one path that must not be the reason a request fails.
 */
const MAX_DEPTH = 8;

/**
 * One pass over everything about to be logged: replace the values of
 * {@link REDACTED_KEYS} and shorten the unbounded ones. Nested objects and
 * arrays are walked because a secret arrives one level down far more often than
 * at the top.
 *
 * The non-array types `JSON.stringify` would flatten or discard are handled
 * explicitly, because "whatever stringify did with it" is not a redaction
 * decision: a `Date` becomes its ISO string, an `Error` becomes
 * name/message/stack, a `Map` and a `Set` are walked entry by entry with their
 * keys checked, and any other object — a class instance, a `URL`, a `Headers` —
 * contributes its enumerable own properties and nothing else. Objects already
 * on the current path become {@link CIRCULAR} rather than recursing forever.
 */
function redact(
  value: unknown,
  key?: string,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): unknown {
  if (typeof value === "string") return truncate(value, key);
  if (depth > MAX_DEPTH) return CIRCULAR;

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (value === null || typeof value !== "object") return value;

  // Only containers below recurse, so only they need to be on the path. An
  // object left out on the way out is one shared by two branches of the payload,
  // not one that loops.
  if (seen.has(value)) return CIRCULAR;
  seen.add(value);

  if (Array.isArray(value)) {
    const out = value.map((item) => redact(item, undefined, seen, depth + 1));
    seen.delete(value);
    return out;
  }

  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of value) {
      const k = String(entryKey);
      out[k] = isRedactedKey(k) ? REDACTED : redact(entryValue, k, seen, depth + 1);
    }
    seen.delete(value);
    return out;
  }

  if (value instanceof Set) {
    const out = [...value].map((item) => redact(item, undefined, seen, depth + 1));
    seen.delete(value);
    return out;
  }

  const out = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      isRedactedKey(k) ? REDACTED : redact(v, k, seen, depth + 1),
    ]),
  );
  seen.delete(value);
  return out;
}

/**
 * Where a redacted error record is forwarded after it reaches stdout.
 *
 * The sink is registered from outside rather than imported, because this module
 * is in the client bundle: a static import of an error-reporting SDK would ship
 * that SDK to every browser. A registration therefore cannot be undone and must
 * only happen once, from the server-side runtime entry point.
 */
type ErrorTransport = (payload: Record<string, unknown>) => void;

let transport: ErrorTransport | null = null;

export function registerErrorTransport(fn: ErrorTransport): void {
  transport = fn;
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
    const record = redact({
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
    }) as Record<string, unknown>;

    console.error(JSON.stringify(record));

    // The already-redacted record, not the inputs: a transport that re-derived
    // its payload would be a second path around the redaction above. Fire and
    // forget — a failed report must not change what the caller sees.
    transport?.(record);
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
