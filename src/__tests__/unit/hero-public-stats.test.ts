import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const { filters } = vi.hoisted(() => ({ filters: [] as unknown[] }));
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => {
        const rows = [{ count: 5 }];
        return Object.assign(Promise.resolve(rows), {
          where: (predicate: unknown) => {
            filters.push(predicate);
            return Promise.resolve([{ count: 2 }]);
          },
        });
      },
    }),
  },
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: null }),
}));
vi.mock(
  "@/src/features/dashboard/server/router/services/projectService",
  () => ({ createProjectService: () => ({}) }),
);
import { projectRouter } from "@/src/features/dashboard/server/router/project";
import { createCallerFactory } from "@/src/lib/trpc/init";

describe("public stats semantics", () => {
  it("counts assistant responses while retaining the anonymous response contract", async () => {
    filters.length = 0;
    const caller = createCallerFactory(projectRouter)({
      userId: null,
      req: null,
      requestId: "hero-stats-test",
    });
    expect(await caller.getPublicStats()).toEqual({
      projectsCount: 5,
      commitsCount: 5,
      messagesCount: 2,
    });
    expect(filters).toHaveLength(1);
    const query = new PgDialect().sqlToQuery(filters[0] as SQL);
    expect(query.sql).toContain('"role" = $1');
    expect(query.params).toEqual(["assistant"]);
  });
});
