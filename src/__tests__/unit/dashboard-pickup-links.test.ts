/**
 * T-003 — every "Pick up where you left off" card must point at a page that
 * actually exists.
 *
 * The cards used to link to `/projects/<id>/chat/<chatId>` and
 * `/projects/<id>`. No `app/**\/projects` route was ever created, so both links
 * 404'd. Nothing caught it because the hrefs were built with a template string
 * and never compared against the router.
 *
 * The allowed prefixes are read off the filesystem rather than hardcoded, so a
 * later route rename fails here instead of silently resurrecting a dead link.
 */

import { describe, it, expect, vi } from "vitest";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Rows the mocked `project_chats` lookup returns. */
let chatRows: unknown[] = [];
/** Rows the mocked `commits` lookup returns. */
let commitRows: unknown[] = [];

/** Chainable no-op query builder; `then` resolves to `rows`. */
function chain(rows: unknown[]) {
  const builder: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
  };
  for (const method of [
    "where",
    "orderBy",
    "limit",
    "leftJoin",
    "innerJoin",
  ]) {
    builder[method] = () => builder;
  }
  return builder;
}

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.projectChats) return chain(chatRows);
          if (table === schema.commitsTable) return chain(commitRows);
          return chain([]);
        },
      }),
    },
  };
});

vi.mock("@/src/lib/inngest/client", () => ({ inngest: { send: async () => {} } }));
vi.mock("@/src/lib/credits", () => ({
  spendCredits: async () => 0,
  PROJECT_CREATION_COST: 0,
  COMMIT_SUMMARY_COST: 0,
}));

vi.mock("@/src/lib/github", () => ({
  createNewProject: vi.fn(),
  getAiSummaryOfCommit: vi.fn(),
  syncIssuesAndComments: vi.fn(),
}));

import { createProjectService } from "@/features/dashboard/server/router/services/projectService";

const APP_DIR = join(process.cwd(), "app");

/** Every `app/**\/page.tsx` below `dir`, recursively. */
function findPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return findPages(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

/**
 * URL paths the App Router actually serves, e.g.
 * `app/(main)/chat/[chatId]/page.tsx` -> `/chat/([^/]+)`.
 *
 * Route groups — `(main)` — and parallel-route slots (`@foo`) are layout
 * concerns and never appear in the URL, so both are dropped.
 */
function realRoutePatterns(): RegExp[] {
  return findPages(APP_DIR).map((file) => {
    const segments = relative(APP_DIR, join(file, ".."))
      .split(sep)
      .filter(
        (segment) =>
          segment !== "" &&
          !segment.startsWith("_") &&
          !segment.startsWith("@") &&
        !(segment.startsWith("(") && segment.endsWith(")")),
      )
      .map((segment) =>
        segment.startsWith("[") && segment.endsWith("]")
          ? "[^/]+"
          : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      );
    return new RegExp(`^/${segments.join("/")}$`);
  });
}

const ROUTES = realRoutePatterns();

async function pickupCards() {
  const { cards } = await createProjectService().getPickUpWhereYouLeftOff(
    "user_1",
  );
  return cards;
}

describe("getPickUpWhereYouLeftOff hrefs", () => {
  it("has real routes to match against", () => {
    // A discovery bug here would make the test below pass vacuously.
    expect(ROUTES.some((r) => r.test("/chat/abc123"))).toBe(true);
    expect(ROUTES.some((r) => r.test("/dashboard/user-project/abc123"))).toBe(
      true,
    );
  });

  it("links the chat card to /chat/<chatId> even when it belongs to a project", async () => {
    chatRows = [
      {
        id: "chat_1",
        title: "Where is the auth middleware",
        projectId: "proj_1",
        projectName: "gitvision",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    commitRows = [];

    const [card] = await pickupCards();
    expect(card.href).toBe("/chat/chat_1");
  });

  it("links the recent-commit card to the project page", async () => {
    chatRows = [];
    commitRows = [
      {
        id: "commit_1",
        commitMessage: "fix: proxy allowlist",
        projectId: "proj_1",
        projectName: "gitvision",
        authorDate: new Date("2026-01-01T00:00:00.000Z"),
        hasSummary: true,
      },
    ];

    const [card] = await pickupCards();
    expect(card.href).toBe("/dashboard/user-project/proj_1");
  });

  it("only ever returns hrefs the router can serve", async () => {
    chatRows = [
      {
        id: "chat_1",
        title: "Where is the auth middleware",
        projectId: "proj_1",
        projectName: "gitvision",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    commitRows = [
      {
        id: "commit_1",
        commitMessage: "fix: proxy allowlist",
        projectId: "proj_1",
        projectName: "gitvision",
        authorDate: new Date("2026-01-01T00:00:00.000Z"),
        hasSummary: true,
      },
    ];

    const cards = await pickupCards();
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(ROUTES.some((route) => route.test(card.href))).toBe(true);
    }
  });
});
