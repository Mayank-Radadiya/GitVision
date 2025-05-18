"use server";

import { auth } from "@clerk/nextjs/server";
import {
  usersTable,
  projectTables,
  projectFiles,
  commitsTable,
  userProjectsTable,
} from "@/drizzle/schema/schema";
import { eq, or, count, sql } from "drizzle-orm";
import { db } from "@/drizzle";

interface dashboardInfo {
  totalProjects: number;
  totalCommits: number;
  totalFiles: number;
  userCredits: number;
}

export async function getUserDashboardInfo(): Promise<dashboardInfo> {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error(
        "Unauthorized. Please sign in to access your dashboard information."
      );
    }

    // 1. Get total number of projects for the user
    // Count projects where the user is either the owner or a collaborator
    const projectsQuery = await db
      .select({
        count: count(projectTables.id),
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
      );

    // 2. Get total number of commits saved by the user
    const commitsQuery = await db
      .select({
        count: count(commitsTable.id),
      })
      .from(commitsTable)
      .innerJoin(projectTables, eq(commitsTable.projectId, projectTables.id))
      .where(
        or(
          eq(projectTables.ownerId, userId),
          sql`EXISTS (
                SELECT 1 FROM ${userProjectsTable}
                WHERE ${userProjectsTable.projectId} = ${projectTables.id}
                AND ${userProjectsTable.userId} = ${userId}
              )`
        )
      );

    // 3. Get total number of files saved by the user
    const filesQuery = await db
      .select({
        count: count(projectFiles.id),
      })
      .from(projectFiles)
      .innerJoin(projectTables, eq(projectFiles.projectId, projectTables.id))
      .where(
        or(
          eq(projectTables.ownerId, userId),
          sql`EXISTS (
                SELECT 1 FROM ${userProjectsTable}
                WHERE ${userProjectsTable.projectId} = ${projectTables.id}
                AND ${userProjectsTable.userId} = ${userId}
              )`
        )
      );

    // 4. Get user's total credits
    const userCreditsQuery = await db
      .select({ credits: usersTable.credits })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    // Extract results from queries
    const totalProjects = Number(projectsQuery[0]?.count || 0);
    const totalCommits = Number(commitsQuery[0]?.count || 0);
    const totalFiles = Number(filesQuery[0]?.count || 0);
    const userCredits = Number(userCreditsQuery[0]?.credits || 0);

    return {
      totalProjects,
      totalCommits,
      totalFiles,
      userCredits,
    };
    
  } catch (error) {
    console.error("Error fetching user dashboard info:", error);
    throw new Error("Failed to fetch user dashboard info");
  }
}
