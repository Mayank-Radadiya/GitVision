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

// jsdom does not implement `window.matchMedia`, so any component that reads a
// media query to decide its layout dies on mount rather than failing an
// assertion. The polyfill actually evaluates the one query shape Tailwind's
// responsive variants are written in — `(min-width: Npx)` — against
// `window.innerWidth`, so a test can drive a breakpoint by setting the width
// instead of by mocking the hook.
//
// Only `min-width` is parsed deliberately. A stub that answered `matches: false`
// for everything would be simpler and would quietly invert the meaning of any
// assertion written against it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    const matches = min ? window.innerWidth >= Number(min[1]) : false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    return {
      media: query,
      matches,
      onchange: null,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
        void listeners.add(listener),
      removeEventListener: (
        _: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => void listeners.delete(listener),
      addListener: (listener: (event: MediaQueryListEvent) => void) =>
        void listeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) =>
        void listeners.delete(listener),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  };
}
