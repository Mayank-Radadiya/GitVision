/**
 * Shared chat error contract, used by both sides of the wire.
 *
 * Server (`categorizeModelError`) maps an SDK/model failure to a code, and the
 * stream's `onError` sends `JSON.stringify({ code, message })` to the client.
 * Pre-stream HTTP errors carry the same `{ code, message }` shape in the body.
 * Client (`parseChatError`) reads either form and renders a categorized card.
 *
 * Pure module — no Node or React imports, so it is safe to import from the
 * route handler (server) and the chat UI (client).
 */

export type ChatErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "rate_limited"
  | "out_of_credits"
  | "project_not_found"
  | "chat_not_found"
  | "timeout"
  | "model_error"
  | "server_error"
  | "network"
  | "aborted";

export interface ChatErrorInfo {
  code: ChatErrorCode;
  /** Human-readable message, shown to the user. */
  message: string;
  /** Short heading for the error card. */
  title: string;
  /** Whether "Try again" (regenerate) is offered. */
  retryable: boolean;
}

export const CHAT_ERROR_META: Record<
  ChatErrorCode,
  { title: string; message: string; retryable: boolean }
> = {
  unauthorized: {
    title: "Session expired",
    message: "Your session has expired. Please sign in again.",
    retryable: false,
  },
  invalid_request: {
    title: "Invalid request",
    message: "The request was invalid. Please try again.",
    retryable: false,
  },
  rate_limited: {
    title: "Slow down",
    message:
      "You're sending messages too quickly. Please wait a moment and try again.",
    retryable: true,
  },
  out_of_credits: {
    title: "Out of credits",
    message: "You're out of credits. Please top up to continue chatting.",
    retryable: false,
  },
  project_not_found: {
    title: "Project unavailable",
    message: "This project no longer exists, or you don't have access to it.",
    retryable: false,
  },
  chat_not_found: {
    title: "Chat unavailable",
    message: "This conversation no longer exists.",
    retryable: false,
  },
  timeout: {
    title: "Request timed out",
    message: "The AI took too long to respond. Please try again.",
    retryable: true,
  },
  model_error: {
    title: "AI service error",
    message: "The AI service had a problem. Please try again.",
    retryable: true,
  },
  server_error: {
    title: "Server error",
    message: "Something went wrong on our end. Please try again.",
    retryable: true,
  },
  network: {
    title: "Network error",
    message: "Could not reach the server. Check your connection and try again.",
    retryable: true,
  },
  aborted: {
    title: "Stopped",
    message: "",
    retryable: false,
  },
};

/**
 * Server-side: map an SDK/model failure to a `{ code, message }` payload sent
 * to the client. Unwraps `RetryError` so the underlying cause is inspected.
 */
export function categorizeModelError(error: unknown): {
  code: ChatErrorCode;
  message: string;
} {
  const err = error as {
    name?: string;
    statusCode?: number;
    errors?: unknown[];
    lastError?: unknown;
    error?: unknown;
  } | null;

  // RetryError wraps the failures in `errors`; the last one is the cause.
  const cause =
    (Array.isArray(err?.errors) && err.errors.length > 0
      ? err.errors[err.errors.length - 1]
      : null) ??
    err?.lastError ??
    err?.error ??
    error;

  const name = (cause as { name?: string })?.name ?? err?.name ?? "";
  const statusCode =
    (cause as { statusCode?: number })?.statusCode ?? err?.statusCode;

  if (statusCode === 429) {
    return {
      code: "rate_limited",
      message: CHAT_ERROR_META.rate_limited.message,
    };
  }
  if (statusCode !== undefined && statusCode >= 500) {
    return {
      code: "model_error",
      message: CHAT_ERROR_META.model_error.message,
    };
  }
  if (name === "TimeoutError" || name.includes("Timeout")) {
    return { code: "timeout", message: CHAT_ERROR_META.timeout.message };
  }
  return { code: "model_error", message: CHAT_ERROR_META.model_error.message };
}

/**
 * Client-side: turn the `error` surfaced by `useChat` into a categorized card.
 *
 * Both server error shapes arrive as a JSON string in `error.message`:
 *   - pre-stream HTTP body: `{"error":"...","code":"..."}`
 *   - stream error text:    `{"code":"...","message":"..."}`
 * User-initiated stops (AbortError) and the `aborted` code return null → no
 * banner.
 */
export function parseChatError(error: unknown): ChatErrorInfo | null {
  if (!error) return null;

  const raw =
    typeof error === "string"
      ? null
      : (error as { name?: string; message?: string; statusCode?: number });
  const message =
    typeof error === "string"
      ? error
      : (raw?.message ?? "Something went wrong.");

  const name = raw?.name ?? "";
  if (name === "AbortError" || /aborted|operation was aborted/i.test(message)) {
    return null;
  }

  let code: ChatErrorCode = "network";
  let serverMessage: string | undefined;

  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.code === "string" && parsed.code in CHAT_ERROR_META) {
        code = parsed.code as ChatErrorCode;
      }
      if (typeof parsed.message === "string") serverMessage = parsed.message;
      if (typeof parsed.error === "string" && !serverMessage) {
        serverMessage = parsed.error;
      }
    }
  } catch {
    // Plain transport error text (e.g. "Failed to fetch") — handled below.
  }

  // Status-code fallback for non-JSON transport errors.
  if (code === "network" && typeof raw?.statusCode === "number") {
    if (raw.statusCode === 429) code = "rate_limited";
    else if (raw.statusCode === 401) code = "unauthorized";
    else if (raw.statusCode === 402) code = "out_of_credits";
    else if (raw.statusCode === 404) code = "server_error";
    else if (raw.statusCode >= 500) code = "server_error";
  }

  if (code === "aborted") return null;
  if (code === "network" && /timed out|timeout/i.test(message))
    code = "timeout";

  const meta = CHAT_ERROR_META[code];
  return {
    code,
    message: serverMessage ?? (code === "network" ? message : meta.message),
    title: meta.title,
    retryable: meta.retryable,
  };
}
