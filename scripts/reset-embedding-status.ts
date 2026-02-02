/**
 * Reset Embedding Status Script
 *
 * This script resets projects that are marked as "completed" but have no actual embeddings.
 * Run this once to fix the data inconsistency.
 *
 * Usage: bun run scripts/reset-embedding-status.ts
 */

import { db } from "@/db";
import { projectTables, codeEmbeddings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

async function resetEmbeddingStatus() {
  console.log("🔍 Checking for projects with incorrect embedding status...\n");

  try {
    // Get all projects marked as "completed"
    const completedProjects = await db
      .select({
        id: projectTables.id,
        projectName: projectTables.projectName,
        embeddingStatus: projectTables.embeddingStatus,
      })
      .from(projectTables)
      .where(eq(projectTables.embeddingStatus, "completed"));

    console.log(
      `Found ${completedProjects.length} projects marked as completed\n`,
    );

    let resetCount = 0;

    for (const project of completedProjects) {
      // Check if this project actually has embeddings
      const embeddingCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(codeEmbeddings)
        .where(eq(codeEmbeddings.projectId, project.id));

      const actualEmbeddings = embeddingCount[0]?.count || 0;

      if (actualEmbeddings === 0) {
        // This project is marked as completed but has no embeddings - reset it
        console.log(`❌ ${project.projectName} (${project.id})`);
        console.log(`   Status: completed, but has 0 embeddings`);
        console.log(`   → Resetting to "pending"`);

        await db
          .update(projectTables)
          .set({
            embeddingStatus: "pending",
            embeddingProgress: 0,
            embeddingError: null,
          })
          .where(eq(projectTables.id, project.id));

        resetCount++;
        console.log(`   ✅ Reset complete\n`);
      } else {
        console.log(`✅ ${project.projectName} (${project.id})`);
        console.log(
          `   Status: completed, has ${actualEmbeddings} embeddings\n`,
        );
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total projects checked: ${completedProjects.length}`);
    console.log(`   Projects reset: ${resetCount}`);
    console.log(`   Projects valid: ${completedProjects.length - resetCount}`);

    // Also check for any projects stuck in "processing"
    const processingProjects = await db
      .select({
        id: projectTables.id,
        projectName: projectTables.projectName,
        embeddingProgress: projectTables.embeddingProgress,
      })
      .from(projectTables)
      .where(eq(projectTables.embeddingStatus, "processing"));

    if (processingProjects.length > 0) {
      console.log(
        `\n⚠️  Found ${processingProjects.length} projects stuck in "processing":`,
      );
      for (const project of processingProjects) {
        console.log(
          `   - ${project.projectName}: ${project.embeddingProgress}%`,
        );
      }
      console.log(`   These can be reset manually if needed.`);
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

// Run the script
resetEmbeddingStatus();
