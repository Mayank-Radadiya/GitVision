"use server";

import { db } from "@/drizzle";
import { projectTables, codeEmbeddings } from "@/drizzle/schema/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, desc, or, sql } from "drizzle-orm";

/**
 * Fetch all user projects with embedding counts
 * Used for chat page to show which projects are ready
 */
export async function fetchAllUserProjectsWithEmbeddings(senderId: string) {
  try {
    const { userId } = await auth();

    if (!userId && !senderId) {
      throw new Error("Unauthorized. Please sign in to access your projects.");
    }

    if (senderId !== userId) {
      throw new Error("Unauthorized. You can only access your own projects.");
    }

    // Get user projects with embedding counts
    const userProjects = await db
      .select({
        id: projectTables.id,
        projectName: projectTables.projectName,
        githubUrl: projectTables.githubUrl,
        totalCommits: projectTables.totalCommits,
        createdAt: projectTables.createdAt,
        embeddingCount: sql<number>`(
          SELECT COUNT(*)
          FROM ${codeEmbeddings}
          WHERE ${codeEmbeddings.projectId} = ${projectTables.id}
        )`,
      })
      .from(projectTables)
      .where(or(eq(projectTables.ownerId, userId)))
      .orderBy(desc(projectTables.createdAt));

    return userProjects;
  } catch (error) {
    console.error("Error fetching user projects:", error);
    throw new Error("Failed to fetch user projects");
  }
}

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

      .where(or(eq(projectTables.ownerId, userId)))
      .orderBy(desc(projectTables.createdAt));

    // return userProjects
    return userProjects;
  } catch (error) {
    console.error("Error fetching user projects:", error);
    throw new Error("Failed to fetch user projects");
  }
}
