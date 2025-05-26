"use server";

import { db } from "@/drizzle";
import { projectTables } from "@/drizzle/schema/schema";
import { eq, desc, or } from "drizzle-orm";

export interface UserProject {
  id: string;
  projectName: string;
  githubUrl: string;
  star: number;
  forks: number;
  totalCommits: number;
  totalBranches: number;
  totalContributors: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetches the user's projects from the API
 * @param userId The ID of the user whose projects to fetch
 */
export const getUserProjects = async (
  userId: string
): Promise<UserProject[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  try {
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

    // Format dates to strings
    const formattedProjects = userProjects.map((project) => ({
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }));

    // Return the projects
    return formattedProjects;
  } catch (error) {
    console.error("Error fetching user projects:", error);
    throw new Error("Failed to fetch user projects");
  }
};
