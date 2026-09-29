# Lane B — status (security)

Branch: `lane/p1-b` (off `main` @ `c9ffe92`)

| Task | Status | Reason | Commit |
|------|--------|--------|--------|
| T-016 | done | secret-file patterns added to `IGNORED_FILE_PATTERNS`; 15 tests added | `c222a3a` |
| T-015 | done | entry names resolved with `posix.normalize`; escaping entries dropped; 5 tests added | `1d27991` |
| T-021 | todo | | |
| T-022 | todo | | |

## Notes

- Files touched outside the lane's declared ownership: none so far.
- T-015 needed no edit to the symlink guard: `header.type !== "file"`
  already excluded `symlink` and `link` entries, which a node script against
  the real `tar-stream` confirmed (both surface `type: "symlink"` /
  `type: "link"`). The test pins that behaviour rather than changing it.
- T-004 has not landed, so `src/__tests__/unit/github-tarball-stream.test.ts`
  was created by T-015, as the task's Notes allow. It mocks `axios` to return a
  real gzipped `tar-stream` pack, so the test exercises the actual gunzip +
  extract path rather than a stubbed parser.
- **Flaky, not lane B:** `src/__tests__/integration/clerk-webhook.test.ts`
  ("upserts on the primary key…") times out at the 5s default under full-suite
  parallel load. It passes when the file is run on its own and passes on re-runs
  of the full suite. Not caused by anything in this lane.
