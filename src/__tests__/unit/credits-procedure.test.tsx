/**
 * The two credit readouts must not drag the whole dashboard payload with them.
 *
 * `SidebarCredits` and `CreditsGauge` each display a single integer, but both
 * read it through `useDashboardInfo()` — a projection of `getDashboardData`,
 * which runs seven queries and ships every project, every recent commit, the
 * commit chart, the language breakdown and the attention list. The create-project
 * page renders `CreditsGauge` and never touches the dashboard otherwise, so it
 * paid for all of it.
 *
 * This pins the cheaper shape: one indexed column read behind a dedicated
 * `getCredits` procedure, which both components point at.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ── db fake: counts how many round trips the service makes ───────────────────

let selects = 0;
let selectResult: unknown[] = [];

function chain() {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown[]) => unknown) =>
      Promise.resolve(selectResult).then(resolve),
  };
  for (const method of ["select", "from", "where", "limit", "orderBy"]) {
    builder[method] = () => builder;
  }
  return builder;
}

vi.mock("@/db", () => ({
  db: {
    select: () => {
      selects += 1;
      return chain();
    },
    update: () => chain(),
  },
}));

vi.mock("@/src/lib/inngest/client", () => ({
  inngest: { send: vi.fn() },
}));

vi.mock("@/src/lib/credits", () => ({
  spendCredits: vi.fn(),
  PROJECT_CREATION_COST: 10,
  COMMIT_SUMMARY_COST: 1,
}));

vi.mock("@/src/lib/github", () => ({
  createNewProject: vi.fn(),
  getAiSummaryOfCommit: vi.fn(),
  syncIssuesAndComments: vi.fn(),
}));

// ── trpc client fake: records which procedure each component asked for ───────

const queried: string[] = [];

/** A different number, so a stale dashboard read can never satisfy the assertion. */
const DASHBOARD_CREDITS = 7;

vi.mock("@/src/lib/trpc/client", () => ({
  trpc: new Proxy(
    {},
    {
      get: (_target, group: string) =>
        new Proxy(
          {},
          {
            get: (_t2, procedure: string) => ({
              useQuery: () => {
                queried.push(`${group}.${procedure}`);
                if (procedure === "getCredits") return { data: 42 };
                return { data: { stats: { userCredits: 7 } } };
              },
            }),
          },
        ),
    },
  ),
}));

import { createProjectService } from "@/src/features/dashboard/server/router/services/projectService";
import { projectRouter } from "@/src/features/dashboard/server/router/project";
import { createCallerFactory } from "@/src/lib/trpc/init";
import { SidebarCredits } from "@/src/features/dashboard/components/sidebar/components/SidebarCredits";
import { CreditsGauge } from "@/src/features/projects/components/create-project/components/CreditsGauge";

const CREDITS = 42;

beforeEach(() => {
  selects = 0;
  selectResult = [{ credits: CREDITS }];
  queried.length = 0;
});

describe("getCredits", () => {
  it("reads the balance in a single query", async () => {
    const service = createProjectService();
    const credits = await service.getCredits("user_1");

    expect(credits).toBe(CREDITS);
    expect(selects).toBe(1);
  });

  it("falls back to 0 for a user with no row", async () => {
    selectResult = [];
    const service = createProjectService();

    await expect(service.getCredits("ghost")).resolves.toBe(0);
  });

  it("is exposed as a protected procedure", async () => {
    const caller = createCallerFactory(projectRouter)({
      userId: "user_1",
      req: undefined,
      requestId: "test-request",
    });

    await expect(caller.getCredits()).resolves.toBe(CREDITS);
  });
});

describe("credit readouts", () => {
  it("SidebarCredits reads getCredits, not the dashboard", () => {
    render(<SidebarCredits isCollapsed={false} />);

    expect(queried).toContain("project.getCredits");
    expect(queried).not.toContain("project.getDashboardData");
    expect(screen.getByText(String(CREDITS))).toBeInTheDocument();
  });

  it("CreditsGauge reads getCredits, not the dashboard", () => {
    render(<CreditsGauge />);

    expect(queried).toContain("project.getCredits");
    expect(queried).not.toContain("project.getDashboardData");
    expect(screen.getByText(String(CREDITS))).toBeInTheDocument();
  });
});
