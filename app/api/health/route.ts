import { NextResponse } from "next/server";
import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { logger } from "@/src/lib/logger";

// A health check that gets cached is worse than no health check: it will
// report "healthy" from a stale response long after the database died.
export const dynamic = "force-dynamic";

/**
 * How long a project may sit in "processing" with no progress recorded
 * before we call it wedged.
 *
 * This is a *no-progress* window, not a total-runtime window. The embedding
 * pipeline is explicitly allowed to run for up to 30 minutes on large repos,
 * so a flat "running longer than 15 minutes" check would page the operator on
 * every healthy large repo. `updatedAt` is rewritten on each progress write,
 * so it is the heartbeat that actually distinguishes "slow" from "dead".
 */
export const STUCK_AFTER_MS = 15 * 60 * 1000;

/** Cap the diagnostic list so a wedged queue cannot grow the response. */
const STUCK_QUERY_LIMIT = 20;

export async function GET() {
  // 1. Can we reach Postgres at all? Without this a failed stuck-query would
  //    be indistinguishable from a healthy queue.
  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    // Log the detail, never return it: this response is the one endpoint
    // without a per-user payload to filter through.
    logger.error(
      `[Health] Database unreachable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return NextResponse.json(
      { status: "unhealthy", database: "down" },
      { status: 503 },
    );
  }

  // 2. Anything claimed but not advanced. `last_embedding_attempt` is only
  //    written when the job *claims* the project, so it cannot tell us whether
  //    the job is still moving; `updatedAt` can.
  const staleBefore = new Date(Date.now() - STUCK_AFTER_MS);

  try {
    const stuck = await db
      .select({
        id: projectTables.id,
        projectName: projectTables.projectName,
        embeddingStatus: projectTables.embeddingStatus,
        updatedAt: projectTables.updatedAt,
      })
      .from(projectTables)
      .where(
        and(
          eq(projectTables.embeddingStatus, "processing"),
          or(
            lt(projectTables.updatedAt, staleBefore),
            isNull(projectTables.updatedAt),
          ),
        ),
      )
      .limit(STUCK_QUERY_LIMIT);

    if (stuck.length > 0) {
      logger.error(
        `[Health] ${stuck.length} project(s) wedged in "processing" for over ${STUCK_AFTER_MS / 60000} minutes`,
      );
      return NextResponse.json(
        {
          status: "degraded",
          database: "up",
          stuckProjects: stuck,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { status: "ok", database: "up", stuckProjects: [] },
      { status: 200 },
    );
  } catch (error) {
    logger.error(
      `[Health] Stuck-project query failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return NextResponse.json(
      { status: "unhealthy", database: "up" },
      { status: 503 },
    );
  }
}
