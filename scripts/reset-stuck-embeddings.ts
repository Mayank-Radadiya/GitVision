import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { logger } from "@/src/lib/logger";
import { repairEmptyIndex, resetAbandonedClaims } from "@/src/lib/indexing-state";

/**
 * Operator repair for projects whose indexing state contradicts reality:
 *
 *   1. rows holding a claim no live run is advancing, and
 *   2. rows claiming `completed` with no embeddings behind them.
 *
 * Both transitions live in `indexing-state.ts` now, so this script is the same
 * shape a future admin endpoint would be — it selects candidates and delegates.
 */
async function resetStuckProjects() {
  // Anything wedged in "processing" past the health check's staleness window is
  // reset in one statement. There is no "recent" filter here: an operator running
  // this has decided every stuck claim is stuck, so the window would only hide
  // rows the operator wants back.
  const STUCK_AFTER_MS = Number(process.env.STUCK_AFTER_MS ?? 15 * 60 * 1000);
  const staleBefore = new Date(Date.now() - STUCK_AFTER_MS);

  const processingResult = await resetAbandonedClaims(staleBefore);

  console.log(
    "Reset 'processing' projects:",
    JSON.stringify(processingResult, null, 2),
  );

  // Rows that claim `completed` but have no embeddings are repaired one project
  // at a time: the count query is per-project, so there is no single statement
  // that expresses "completed and empty".
  const completedProjects = await db
    .select({
      id: projectTables.id,
      name: projectTables.projectName,
    })
    .from(projectTables)
    .where(eq(projectTables.embeddingStatus, "completed"));

  let staleCount = 0;
  for (const project of completedProjects) {
    const repaired = await repairEmptyIndex(project.id);

    if (repaired) {
      console.log(
        `Reset stale 'completed' project: ${project.name} (${project.id})`,
      );
      staleCount++;
    }
  }

  console.log(
    `\nSummary: Reset ${processingResult.length} processing + ${staleCount} stale completed projects`,
  );
  process.exit(0);
}

resetStuckProjects().catch((e) => {
  logger.error("reset-stuck-embeddings failed:", e);
  console.error("Error:", e);
  process.exit(1);
});