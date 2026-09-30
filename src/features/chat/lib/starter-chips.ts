/**
 * Starter-question chips for the empty chat state (F-03).
 *
 * Both exports are pure: no React, no `fetch`, no LLM client. The chips are a
 * function of what the project row already stores — `projects.languages` and the
 * dependency names parsed out of the indexed `package.json` — so the empty state
 * costs zero extra work and zero model tokens. Same input, same four chips.
 *
 * `parsePackageJsonDeps` lives here rather than in the router because the router
 * has the raw `project_files.code` text and this module knows the shape worth
 * keeping. It returns names, never versions: the chip logic only asks "is Clerk
 * in this project", and a version string would invite a naive substring match
 * that a repo called `passport-foo` could fake.
 */

/**
 * Package names that mean "this project authenticates users". Matched exactly or
 * as a scope prefix (`@clerk/nextjs` matches `@clerk/nextjs`, but not
 * `next-auth-mock`), so a similarly-named unrelated dependency cannot switch the
 * auth chip on.
 */
const AUTH_PACKAGES = [
  "@clerk/nextjs",
  "@clerk/clerk-react",
  "next-auth",
  "@auth/core",
  "passport",
  "passport-jwt",
  "passport-local",
  "lucia",
  "@auth0/nextjs-auth0",
  "better-auth",
  "iron-session",
  "@supabase/auth-helpers-nextjs",
] as const;

const CHIP_COUNT = 4;

/** True when `name` is a known auth package, ignoring scoped subpaths. */
function isAuthPackage(name: string): boolean {
  return AUTH_PACKAGES.some(
    (pkg) => name === pkg || name.startsWith(`${pkg}/`),
  );
}

/**
 * Dependency names from a `package.json` body, dependencies and devDependencies
 * merged. A repo's auth is as often a devDependency-adjacent SDK as a runtime
 * one, and the chip only needs presence.
 *
 * Anything unparseable — the file was never indexed, it is not actually JSON, or
 * the columns are not objects — yields an empty list rather than throwing. A
 * missing `package.json` is the normal case for a Go or Rust repository, and
 * this runs on the chat page render.
 */
export function parsePackageJsonDeps(
  code: string | null | undefined,
): string[] {
  if (!code) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(code);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];

  const { dependencies, devDependencies } = parsed as Record<
    string,
    unknown
  >;
  const names = (value: unknown): string[] =>
    value && typeof value === "object" ? Object.keys(value) : [];

  return [...names(dependencies), ...names(devDependencies)];
}

/**
 * The four chips for a project chat, in priority order.
 *
 * Auth is the only conditional chip: it is worth a slot when the project has an
 * auth package and a dead end when it does not, so a repository with no auth at
 * all falls through to the testing question and still gets four. Everything
 * else is unconditional, so the count is `CHIP_COUNT` for every project.
 */
export function getStarterChips(
  languages: string[] = [],
  dependencies: string[] = [],
): string[] {
  // The caller already ordered these by share; join what it gave us so the
  // architecture chip names the stack the developer actually sees in the repo.
  const stack = languages.slice(0, 2).join(" + ");
  const hasAuth = dependencies.some(isAuthPackage);

  const chips = [
    stack
      ? `What is the high-level architecture of this ${stack} codebase?`
      : "What is the high-level architecture and tech stack of this repository?",
    ...(hasAuth
      ? ["How does authentication and session management work?"]
      : []),
    "Where are the main entry points and API routes defined?",
    "How is data persisted and structured in the database?",
    "How is the project tested, and how do I run the tests?",
  ];

  return chips.slice(0, CHIP_COUNT);
}
