"use server";

import { db } from "@/drizzle";
import { projectTables, userProjectsTable } from "@/drizzle/schema/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, desc, or } from "drizzle-orm";

export async function fetchAllUserProject(senderId: string) {
  try {
    const { userId } = await auth();

    if (!userId && !senderId) {
      throw new Error("Unauthorized. Please sign in to access your projects.");
    }

    if (senderId !== userId) {
      throw new Error("Unauthorized. You can only access your own projects.");
    }

    // Get user projects (both owned and collaborative)
    const userProjects = await db
      .select({
        id: projectTables.id,
        projectName: projectTables.projectName,
        githubUrl: projectTables.githubUrl,
        star: projectTables.star,
        forks: projectTables.forks,
        totalCommits: projectTables.totalCommits,
        totalBranches: projectTables.totalBranches,
        totalContributors: projectTables.totalContributors,
        createdAt: projectTables.createdAt,
        updatedAt: projectTables.updatedAt,
      })
      .from(projectTables)
      .leftJoin(
        userProjectsTable,
        eq(userProjectsTable.projectId, projectTables.id)
      )
      .where(
        or(
          eq(projectTables.ownerId, userId),
          eq(userProjectsTable.userId, userId)
        )
      )
      .orderBy(desc(projectTables.createdAt));

    // return userProjects
    return userProjects;
  } catch (error) {
    console.error("Error fetching user projects:", error);
    throw new Error("Failed to fetch user projects");
  }
}
