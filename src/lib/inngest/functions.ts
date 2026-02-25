import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRepositoryFiles, syncIssuesAndComments } from "../github";
import { inngest } from "./client";

export const projectCreated = inngest.createFunction(
  {
    id: "project-created",
    retries: 3, // Automatically retry failed jobs up to 3 times
  },
  { event: "project/created" },
  async ({ event, step }) => {
    const { projectId, repoUrl, owner, repo } = event.data;

    // Step 1: Import all repository files (tarball extraction & chunking)
    await step.run("Import Files", async () => {
      try {
        console.log(`[Inngest] Starting file import for ${projectId}`);
        await getRepositoryFiles(owner, repo, projectId);
      } catch (error) {
        console.error(`[Inngest] File import failed for ${projectId}:`, error);
        throw error;
      }
    });

    // Step 2: Sync issues and comments
    await step.run("Sync Issues", async () => {
      try {
        console.log(`[Inngest] Starting issue sync for ${projectId}`);
        await syncIssuesAndComments(repoUrl, projectId);
      } catch (error) {
        console.error(`[Inngest] Issue sync failed for ${projectId}:`, error);
        throw error;
      }
    });

    // Step 3: Finalize status
    await step.run("Finalize Project", async () => {
      console.log(`[Inngest] Finalizing project ${projectId}`);
      await db
        .update(projectTables)
        .set({
          embeddingStatus: "completed",
        })
        .where(eq(projectTables.id, projectId));
    });

    return { success: true, projectId };
  },
);
