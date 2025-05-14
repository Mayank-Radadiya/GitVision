import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle";
import { projectTables, userProjectsTable } from "@/drizzle/schema/schema";
import { eq, or } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");

    // Get the authenticated user from the Clerk session
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to access project details." },
        { status: 401 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Get project details, checking that the user has access to this project (either as owner or collaborator)
    const projectResult = await db
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
        ownerId: projectTables.ownerId,
      })
      .from(projectTables)
      .leftJoin(
        userProjectsTable,
        eq(userProjectsTable.projectId, projectTables.id)
      )
      .where(
        eq(projectTables.id, projectId) &&
          or(
            eq(projectTables.ownerId, userId),
            eq(userProjectsTable.userId, userId)
          )
      )
      .limit(1);

    if (!projectResult || projectResult.length === 0) {
      return NextResponse.json(
        { error: "Project not found or you don't have access to it" },
        { status: 404 }
      );
    }

    // Format dates to strings
    const formattedProject = {
      ...projectResult[0],
      createdAt: projectResult[0].createdAt.toISOString(),
      updatedAt: projectResult[0].updatedAt.toISOString(),
    };

    return NextResponse.json(
      {
        message: "Project details retrieved successfully",
        project: formattedProject,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching project details:", error);
    return NextResponse.json(
      { error: "Failed to fetch project details" },
      { status: 500 }
    );
  }
}
