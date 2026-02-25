"use server";

import { auth } from "@clerk/nextjs/server";
import {
  usersTable,
  projectTables,
  projectFiles,
  commitsTable,
} from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { db } from "@/db";

interface DashboardInfo {
  totalProjects: number;
  totalCommits: number;
  totalFiles: number;
  userCredits: number;
}

export async function getUserDashboardInfo(): Promise<DashboardInfo> {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error(
        "Unauthorized. Please sign in to access your dashboard information.",
      );
    }

    // Run all 4 independent database queries AT THE SAME TIME
    const [projectsQuery, commitsQuery, filesQuery, userCreditsQuery] =
      await Promise.all([
        // 1. Get total projects
        db
          .select({ count: count(projectTables.id) })
          .from(projectTables)
          .where(eq(projectTables.ownerId, userId)), // Removed unnecessary or()

        // 2. Get total commits
        db
          .select({ count: count(commitsTable.id) })
          .from(commitsTable)
          .innerJoin(
            projectTables,
            eq(commitsTable.projectId, projectTables.id),
          )
          .where(eq(projectTables.ownerId, userId)), // 🔥 FIX: Added missing where clause

        // 3. Get total files
        db
          .select({ count: count(projectFiles.id) })
          .from(projectFiles)
          .innerJoin(
            projectTables,
            eq(projectFiles.projectId, projectTables.id),
          )
          .where(eq(projectTables.ownerId, userId)), // 🔥 FIX: Added missing where clause

        // 4. Get user credits
        db
          .select({ credits: usersTable.credits })
          .from(usersTable)
          .where(eq(usersTable.id, userId)),
      ]);

    return {
      totalProjects: Number(projectsQuery[0]?.count || 0),
      totalCommits: Number(commitsQuery[0]?.count || 0),
      totalFiles: Number(filesQuery[0]?.count || 0),
      userCredits: Number(userCreditsQuery[0]?.credits || 0),
    };
  } catch (error) {
    console.error("Error fetching user dashboard info:", error);
    throw new Error("Failed to fetch user dashboard info");
  }
}
