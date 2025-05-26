import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle";
import { commitsTable, projectTables } from "@/drizzle/schema/schema";
import { eq, desc, or, count } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : 10;
    const page = searchParams.get("page")
      ? parseInt(searchParams.get("page")!)
      : 1;
    const offset = (page - 1) * limit;

    // Get the authenticated user from the Clerk session
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to access project commits." },
        { status: 401 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Verify user has access to this project (either as owner or collaborator)
    const userProject = await db
      .select()
      .from(projectTables)

      .where(
        eq(projectTables.id, projectId) && or(eq(projectTables.ownerId, userId))
      )
      .limit(1);

    if (!userProject || userProject.length === 0) {
      return NextResponse.json(
        { error: "Project not found or you don't have access to it" },
        { status: 404 }
      );
    }

    // Get total number of commits for pagination
    const commitsCountResult = await db
      .select({ count: count() })
      .from(commitsTable)
      .where(eq(commitsTable.projectId, projectId));

    const totalCommits = commitsCountResult[0]?.count || 0;

    // Get project commits with pagination
    const commits = await db
      .select()
      .from(commitsTable)
      .where(eq(commitsTable.projectId, projectId))
      .orderBy(desc(commitsTable.authorDate))
      .limit(limit)
      .offset(offset);

    // Format dates to strings
    const formattedCommits = commits.map((commit) => ({
      ...commit,
      authorDate: commit.authorDate.toISOString(),
      committerDate: commit.committerDate.toISOString(),
      createdAt: commit.createdAt.toISOString(),
    }));

    return NextResponse.json(
      {
        message: "Project commits retrieved successfully",
        commits: formattedCommits,
        pagination: {
          total: totalCommits,
          page,
          limit,
          totalPages: Math.ceil(totalCommits / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching project commits:", error);
    return NextResponse.json(
      { error: "Failed to fetch project commits" },
      { status: 500 }
    );
  }
}
