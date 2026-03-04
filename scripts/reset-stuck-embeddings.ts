import { db } from "@/db";
import { projectTables, codeEmbeddings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

async function resetStuckProjects() {
  // 1. Reset projects stuck in "processing"
  const processingResult = await db
    .update(projectTables)
    .set({
      embeddingStatus: "pending",
      embeddingProgress: 0,
      embeddingError: null,
    })
    .where(eq(projectTables.embeddingStatus, "processing"))
    .returning({ id: projectTables.id, name: projectTables.projectName });

  console.log(
    "Reset 'processing' projects:",
    JSON.stringify(processingResult, null, 2),
  );

  // 2. Reset projects marked "completed" but with 0 actual embeddings
  const completedProjects = await db
    .select({
      id: projectTables.id,
      name: projectTables.projectName,
    })
    .from(projectTables)
    .where(eq(projectTables.embeddingStatus, "completed"));

  let staleCount = 0;
  for (const project of completedProjects) {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(codeEmbeddings)
      .where(eq(codeEmbeddings.projectId, project.id));

    if ((countResult?.count ?? 0) === 0) {
      await db
        .update(projectTables)
        .set({
          embeddingStatus: "pending",
          embeddingProgress: 0,
          embeddingError: null,
        })
        .where(eq(projectTables.id, project.id));

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
  console.error("Error:", e);
  process.exit(1);
});
