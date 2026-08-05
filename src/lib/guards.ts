// ============================================================================
// Ownership Guards — tenant isolation for project-scoped resources
// ============================================================================
// Single point of verification before any project read/mutation. Filters
// strictly by ownerId so a user can never see or touch another user's data.
// Used by both Next.js route handlers and tRPC routers.

import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type ProjectRow = typeof projectTables.$inferSelect;

/** Thrown when a project is missing OR not owned by the requesting user. */
export class ProjectAccessError extends Error {
  constructor(message = "Project not found") {
    super(message);
    this.name = "ProjectAccessError";
  }
}

/**
 * Returns the project row if `userId` owns `projectId`, otherwise throws.
 * The query itself scopes by owner — no existence leak to non-owners.
 */
export async function assertProjectOwnership(
  projectId: string,
  userId: string,
): Promise<ProjectRow> {
  const rows = await db
    .select()
    .from(projectTables)
    .where(
      and(
        eq(projectTables.id, projectId),
        eq(projectTables.ownerId, userId), // ← tenant isolation in one query
      ),
    )
    .limit(1);

  const project = rows[0];
  if (!project) {
    throw new ProjectAccessError();
  }
  return project;
}
