import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { projectRenameSchema } from "@/src/lib/validation/schemas";

const query = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("@/db", () => ({ db: { update: query.update } }));
vi.mock("@/src/lib/github", () => ({
  createNewProject: vi.fn(),
  getAiSummaryOfCommit: vi.fn(),
  syncIssuesAndComments: vi.fn(),
}));
vi.mock("@/src/lib/inngest/client", () => ({ inngest: { send: vi.fn() } }));
vi.mock("@/src/lib/guards", () => ({ assertProjectOwnership: vi.fn() }));
vi.mock("@/src/lib/credits", () => ({
  openCharge: vi.fn(),
  PROJECT_CREATION_COST: 1,
  COMMIT_SUMMARY_COST: 1,
}));

import { createProjectService } from "@/src/features/dashboard/server/router/services/projectService";

const projectId = "22222222-2222-4222-8222-222222222222";

describe("project rename", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.update.mockReturnValue({ set: query.set });
    query.set.mockReturnValue({ where: query.where });
    query.where.mockReturnValue({ returning: query.returning });
  });

  it("trims names and rejects blank, oversized, and HTML names", () => {
    expect(
      projectRenameSchema.parse({ projectId, projectName: "  Workspace  " })
        .projectName,
    ).toBe("Workspace");
    for (const projectName of ["   ", "x".repeat(256), "<script>"]) {
      expect(
        projectRenameSchema.safeParse({ projectId, projectName }).success,
      ).toBe(false);
    }
    expect(
      projectRenameSchema.safeParse({
        projectId: "invalid",
        projectName: "Workspace",
      }).success,
    ).toBe(false);
  });

  it("enforces ownership in the update itself", async () => {
    query.returning.mockResolvedValue([
      { id: projectId, projectName: "Workspace" },
    ]);
    const result = await createProjectService().renameProject(
      projectId,
      "owner-123",
      "Workspace",
    );
    const sql = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
    expect(sql.sql).toContain('"projects"."id"');
    expect(sql.sql).toContain('"projects"."owner_id"');
    expect(sql.params).toEqual([projectId, "owner-123"]);
    expect(query.set).toHaveBeenCalledWith({
      projectName: "Workspace",
      updatedAt: expect.any(Date),
    });
    expect(result).toEqual({ id: projectId, projectName: "Workspace" });
  });

  it("returns not found for a missing or unowned project", async () => {
    query.returning.mockResolvedValue([]);
    await expect(
      createProjectService().renameProject(
        projectId,
        "other-owner",
        "Workspace",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
