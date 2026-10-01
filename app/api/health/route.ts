import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { logger } from "@/src/lib/logger";
import { findAbandonedClaims } from "@/src/lib/indexing-state";
import { STUCK_AFTER_MS } from "@/src/lib/health";

// A health check that gets cached is worse than no health check: it will
// report "healthy" from a stale response long after the database died.
export const dynamic = "force-dynamic";

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
    // `projectName` is the customer's data and this response is public, so the
    // query behind this interface selects only the fields an operator needs.
    const stuck = await findAbandonedClaims(staleBefore, STUCK_QUERY_LIMIT);

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
