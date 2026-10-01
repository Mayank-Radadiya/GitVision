import "@testing-library/jest-dom";

// `db/index.ts` builds its neon client at module scope, so *any* suite that
// transitively imports a tRPC router dies at import — not at test time, not at
// the first query — when DATABASE_URL is absent. A suite that only exercises a
// router's rate-limit guards does exactly that while never touching the
// database, so it cannot skip itself: the skip guard is evaluated after the
// import has already thrown.
//
// The client is lazy, so a placeholder URL satisfies construction without
// opening a connection. Suites that DO query gate themselves on
// `hasTestDatabase` (TEST_DATABASE_URL), so this only has to be importable.
process.env.DATABASE_URL ??=
  "postgresql://unused:unused@localhost:5432/unused";
