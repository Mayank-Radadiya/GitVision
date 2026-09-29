import { describe, it, expect, vi, beforeEach } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    chatRows: [] as Record<string, unknown>[],
    commitRows: [] as Record<string, unknown>[],
    selects: 0,
  },
}));

vi.mock("@/db", () => {
  const builderFor = (rows: unknown) => {
    const builder: Record<string, unknown> = {};
    for (const method of [
      "from",
      "leftJoin",
      "innerJoin",
      "where",
      "orderBy",
      "limit",
      "offset",
    ]) {
      builder[method] = () => builder;
    }
    // Thenable, so `await Promise.all([...])` unwraps it the way a real
    // Drizzle query builder does.
    builder.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(rows).then(onFulfilled, onRejected);
    return builder;
  };
  return {
    db: {
      // `getPickUpWhereYouLeftOff` issues exactly two selects: the most
      // recent chat, then the most recent commit.
      select: () => ({ from: () => builderFor(state.selects++ === 0 ? state.chatRows : state.commitRows) }),
    },
  };
});

vi.mock("@/src/lib/github", () => ({
  createNewProject: vi.fn(),
  getAiSummaryOfCommit: vi.fn(),
  syncIssuesAndComments: vi.fn(),
}));
vi.mock("@/src/lib/inngest/client", () => ({ inngest: { send: vi.fn() } }));
vi.mock("@/src/lib/credits", () => ({
  spendCredits: vi.fn(),
  PROJECT_CREATION_COST: 1,
  COMMIT_SUMMARY_COST: 1,
}));

import { createProjectService } from "@/src/features/dashboard/server/router/services/projectService";

const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

// The only prefixes that resolve to a real page in this app. A card pointing
// anywhere else is a 404.
const REAL_ROUTE_PREFIXES = ["/chat/", "/dashboard/user-project/"];

describe("getPickUpWhereYouLeftOff card links", () => {
  beforeEach(() => {
    state.selects = 0;
    state.chatRows.length = 0;
    state.commitRows.length = 0;
  });

  it("links the chat card at a chat that belongs to a project", async () => {
    // The project branch of the old ternary built `/projects/<id>/chat/<id>`,
    // which no route has ever served.
    state.chatRows.push({ id: CHAT_ID, title: "Refactor", projectId: PROJECT_ID, projectName: "demo" });
    state.commitRows.push({
      id: "c1",
      commitMessage: "fix: thing",
      projectId: PROJECT_ID,
      projectName: "demo",
      authorDate: new Date(),
      hasSummary: false,
    });

    const { cards } = await createProjectService().getPickUpWhereYouLeftOff("user_1");

    expect(cards).toHaveLength(2);
    expect(cards[0].href).toBe(`/chat/${CHAT_ID}`);
    expect(cards[1].href).toBe(`/dashboard/user-project/${PROJECT_ID}`);
  });

  it("links the commit card to the project page", async () => {
    state.commitRows.push({
      id: "c1",
      commitMessage: "chore: tidy",
      projectId: PROJECT_ID,
      projectName: "demo",
      authorDate: new Date(),
      hasSummary: false,
    });

    const { cards } = await createProjectService().getPickUpWhereYouLeftOff("user_1");

    expect(cards).toHaveLength(1);
    expect(cards[0].href).toBe(`/dashboard/user-project/${PROJECT_ID}`);
  });

  it("only ever links to a real route", async () => {
    state.chatRows.push({ id: CHAT_ID, title: "t", projectId: null, projectName: null });
    state.commitRows.push({
      id: "c1",
      commitMessage: "m",
      projectId: PROJECT_ID,
      projectName: "demo",
      authorDate: new Date(),
      hasSummary: false,
    });

    const { cards } = await createProjectService().getPickUpWhereYouLeftOff("user_1");

    for (const card of cards) {
      expect(card.href).not.toMatch(/^\/projects\//);
      expect(REAL_ROUTE_PREFIXES.some((prefix) => card.href.startsWith(prefix))).toBe(true);
    }
  });
});
