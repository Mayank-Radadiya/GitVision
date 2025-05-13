import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle";
import { projectTables, userProjectsTable } from "@/drizzle/schema/schema";
import { eq, desc, or } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const SenderUserId = searchParams.get("userId");

    // Get the authenticated user from the Clerk session
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to access your projects." },
        { status: 401 }
      );
    }

    if (SenderUserId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized. You can only access your own projects." },
        { status: 403 }
      );
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

    // Format dates to strings
    const formattedProjects = userProjects.map((project) => ({
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }));

    // Return the projects
    return NextResponse.json(
      {
        message: "Projects retrieved successfully",
        userProjects: formattedProjects, // Changed 'projects' to 'userProjects' to match frontend expectation
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching user projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
