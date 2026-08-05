# LLM Call Resilience — Design

Date: 2026-08-05 · Status: Approved · Branch: `feat/llm-call-resilience`

## Problem

Four robustness gaps in the AI/RAG chat pipeline (all three Gemini call sites affected):

1. **No streaming error handling on the client** — `useChat`'s `onError` is unused; the error banner
   shows a hardcoded "Something went wrong" and never surfaces the server's `{ error }` message or
   the actual failure cause (timeout vs. rate limit vs. credits vs. model failure).
2. **No timeout/abort on the LLM call** — neither `streamText` nor `generateText` passes `timeout`
   or `abortSignal`, so a stalled/hung model call runs forever and a client Stop/unmount never
   cancels the upstream Gemini request.
3. **No retry logic for chat calls** — `maxRetries` is left at the SDK default implicitly; only
   embedding batches and the GitHub client have explicit retry handling.
4. **No max-tokens cap on model calls** — unbounded output means unbounded cost and latency.

## Scope

Three Gemini `gemini-2.5-flash` call sites:

| Site | File:line | Type |
|---|---|---|
| Main chat | `app/api/chat/route.ts` `streamText` | stream |
| Query rewrite | `app/api/chat/route.ts` `generateText` (in `rewriteQueryForRetrieval`) | single |
| Commit summary | `src/lib/gemini.ts` `generateText` | single |

Embedding calls (OpenRouter) are out of scope — the user confirmed they already have retry handling.

## Decisions

- **Scope:** all three calls.
- **Retry:** server-side only (`maxRetries` in the SDK). Credits are spent once per request before the
  model call; client auto-retry would double-charge a credit on every failure, so the client exposes a
  manual "Try again" instead.
- **Error UX:** categorized with the real server message.

## Changes

### 1. `src/lib/llm/config.ts` (new) — single tuning point

```ts
export const LLM_SETTINGS = {
  chat: { model: "gemini-2.5-flash", maxRetries: 2, maxOutputTokens: 2048,
          timeout: { totalMs: 90_000, firstChunkMs: 20_000, chunkMs: 10_000 } },
  queryRewrite: { model: "gemini-2.5-flash", maxRetries: 1, maxOutputTokens: 40,
                  timeout: { totalMs: 10_000, stepMs: 10_000 } },
  commitSummary: { model: "gemini-2.5-flash", maxRetries: 2, maxOutputTokens: 1500,
                   timeout: { totalMs: 30_000, stepMs: 30_000 } },
} as const;
```

Notes:
- Query rewrite is best-effort (falls back to the raw message on failure) → `maxRetries: 1` so a
  failed helper never delays the real answer with backoff.
- Chat timeout uses streaming fields (`firstChunkMs`, `chunkMs`) to abort a stalled stream; the other
  two use `stepMs`.

### 2. `src/shared/lib/chat-errors.ts` (new) — one contract, both sides

- `ChatErrorCode` union: `unauthorized | invalid_request | rate_limited | out_of_credits |
  project_not_found | chat_not_found | timeout | model_error | server_error | network | aborted`.
- `ChatErrorInfo { code, message, title, retryable }`.
- `categorizeModelError(error): { code, message }` — server-side; maps SDK errors (429 → rate_limited,
  5xx → model_error, `TimeoutError`/timeout-abort → timeout, else → model_error).
- `parseChatError(error): ChatErrorInfo | null` — client-side; tries `JSON.parse(error.message)` to
  read the server-emitted `{ code, message }` (HTTP body and stream error both use this shape), falls
  back to message text, returns `null` for user-initiated aborts (`AbortError` / code `aborted`).
- `CHAT_ERROR_META` map — `title` + `retryable` per code.
- Pure module, no Node/React imports → safely shared by the route (server) and the chat UI (client).

### 3. `app/api/chat/route.ts` — server hardening

- `streamText(...)`: add `maxRetries`, `maxOutputTokens`, `timeout` from `LLM_SETTINGS.chat`, and
  `abortSignal: req.signal` (client Stop/unmount cancels the upstream call; no ghost streams).
- `rewriteQueryForRetrieval(...)`: accept `abortSignal`; add `maxRetries`, `maxOutputTokens`, `timeout`
  from `LLM_SETTINGS.queryRewrite`.
- `createUIMessageStream({ onError })`:
  - if `req.signal.aborted` → return `JSON.stringify({ code: "aborted", message: "" })` (client ignores).
  - else → `categorizeModelError(error)` → `JSON.stringify({ code, message })`, log server-side.
  - This replaces the SDK default `() => "An error occurred."`, surfacing the real cause to the client.
- Add `code` to pre-stream HTTP error bodies (401, 400, 404 chat, 404 project, 429, 402, 500) so the
  client can categorize without relying on SDK-internal status fields.

### 4. `src/lib/gemini.ts` — commit summary

- Add `maxRetries`, `maxOutputTokens`, `timeout` from `LLM_SETTINGS.commitSummary`. No `abortSignal` —
  it is called from a background GitHub service, not a request handler.

### 5. Client — `chat-room.tsx` + `chat-error.tsx` (new)

- `useChat({ onError: (err) => setChatError(parseChatError(err)) })`; also reset the first-token
  streaming flags on error so the UI never sticks mid-stream after a failure.
- Clear `chatError` on new submit and on reload.
- New `ChatErrorCard` component replaces the hardcoded banner: category icon, real message, "Try
  again" button (only when `retryable`), wired to `reload()` (regenerate).
- `chat-error.tsx` is small and presentational (icon + text + optional button).

### 6. `scripts/llm-safety-selfcheck.ts` (new) — one runnable check

Runnable via `tsx` (already a devDependency). Asserts:
- `parseChatError` returns `null` for user abort, parses `{ code, message }` JSON into the right
  category, and falls back gracefully for plain-text errors.
- `categorizeModelError` maps 429 → rate_limited, 5xx → model_error, TimeoutError → timeout.

## Error handling summary

| Failure | Server | Client shows |
|---|---|---|
| Client Stop | stream aborts, `req.signal.aborted` → `aborted` | no banner (user-initiated) |
| LLM timeout / stall | `timeout` aborts upstream → `{ code:"timeout" }` | "Request timed out" + Try again |
| Gemini 5xx / network | `maxRetries` exhausted → `{ code:"model_error" }` | "AI service error" + Try again |
| Rate limit (429) | HTTP 429 `{ code:"rate_limited" }` | "Slow down" + Try again |
| Out of credits (402) | HTTP 402 `{ code:"out_of_credits" }` | "Out of credits", no retry |
| Unauthorized (401) | HTTP 401 `{ code:"unauthorized" }` | "Session expired", no retry |
| Project/chat gone (404) | HTTP 404 `{ code:"..." }` | "Unavailable", no retry |

## Verification

1. `npx tsx scripts/llm-safety-selfcheck.ts` — asserts on the pure functions.
2. `npx tsc --noEmit` (or `npm run lint`) — type-safety across route/client changes.
3. Manual smoke: start a chat, trigger a stop, and (if reachable) a rate limit — confirm categorized
   messages render.
