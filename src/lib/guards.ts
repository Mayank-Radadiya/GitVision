// ============================================================================
// Ownership Guards — tenant isolation for project-scoped resources
// ============================================================================
// Single point of verification before any project read/mutation. Filters
// strictly by ownerId so a user can never see or touch another user's data.
// Used by both Next.js route handlers and tRPC routers.

import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

type ProjectRow = typeof projectTables.$inferSelect;

/**
 * Thrown when a project is missing OR not owned by the requesting user.
 *
 * Two audiences, one type: it extends `TRPCError` so a tRPC router that lets it
 * escape is answered `NOT_FOUND` (a plain `Error` there becomes a 500 and
 * hands the caller a wrong status), and it stays catchable by name in the
 * Next.js route handlers that map it to their own 404. The message is
 * deliberately identical for "missing" and "not yours" — see the security note
 * on `assertProjectOwnership`.
 */
export class ProjectAccessError extends TRPCError {
  constructor(message = "Project not found") {
    super({ code: "NOT_FOUND", message });
    this.name = "ProjectAccessError";
  }
}

/**
 * The single ownership check for project-scoped reads and mutations.
 *
 * SECURITY PROPERTY: the ownerId filter lives *inside* this query, and the
 * failure message is the same whether the project does not exist or belongs to
 * someone else. That is what makes a foreign `projectId` a 404 rather than an
 * existence oracle. Do not inline a cheaper `findById` here or anywhere else —
 * a lookup-then-compare split either leaks existence or drops the owner
 * predicate, and it leaves two implementations to keep in sync.
 *
 * @throws {ProjectAccessError} (a `TRPCError` with `NOT_FOUND`) on any miss.
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
