# Lane A — chat + credits

| Task | Status | Reason | Commit |
|---|---|---|---|
| T-006 Refund the credit when chat retrieval fails | done | RAG retrieval failure now fails the turn instead of silently degrading; the stream's `onError` latches exactly one refund | d38344f |
| T-011 Remove dead imports and unused `baseProcedure` export | done | `usersTable`, `gte`, `sql` removed from the chat route; `baseProcedure` unexported, `protectedProcedure` now uses `t.procedure` | e6000d7 |

Checks after T-006: `bun run typecheck` clean, `bun run lint` clean, `bun run test` 34 files / 184 tests passed (2 files + 11 tests skipped pre-existing).

## Notes

- **T-006 fix**: the RAG retrieval `catch` in `app/api/chat/route.ts` now rethrows. Rationale per the task spec: refund AND degrade would give the user a free answer that lies about its grounding, so only one behaviour is allowed. Rethrowing routes the error to `createUIMessageStream`'s `onError`, which calls the existing latched `refundOnce()` — exactly once, since the `refunded` flag guards against `onFinish` firing too.
- **T-006 tests**: added two cases to the existing `src/__tests__/integration/chat-credit-refund.test.ts` (a project-mode retrieval failure refunds and never reaches the model; a successful project turn is charged normally). The file's `ai` mock was made to route an `execute` rejection to `onError` like the real SDK, which is what makes the throw observable.
- No files outside Lane A's ownership were touched.
