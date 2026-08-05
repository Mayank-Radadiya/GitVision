import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { commitsTable } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { assertProjectOwnership, ProjectAccessError } from "@/src/lib/guards";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const limit = parseInt(searchParams.get("limit") || "10");
    const page = parseInt(searchParams.get("page") || "1");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    // Tenant isolation: 404 if the project isn't owned by this user
    await assertProjectOwnership(projectId, userId);

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Fetch commits + count in parallel
    const [commits, countRows] = await Promise.all([
      db
        .select()
        .from(commitsTable)
        .where(eq(commitsTable.projectId, projectId))
        .orderBy(desc(commitsTable.authorDate))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(commitsTable)
        .where(eq(commitsTable.projectId, projectId)),
    ]);

    const total = countRows[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      commits: commits.map((commit) => ({
        id: commit.id,
        commitHash: commit.commitHash,
        commitMessage: commit.commitMessage,
        AiSummary: commit.AiSummary,
        authorName: commit.authorName,
        authorEmail: commit.authorEmail,
        authorAvatar: commit.authorAvatar,
        authorDate: commit.authorDate.toISOString(),
        committerName: commit.committerName,
        committerEmail: commit.committerEmail,
        committerDate: commit.committerDate.toISOString(),
        projectId: commit.projectId,
        createdAt: commit.createdAt.toISOString(),
      })),
      pagination: {
        totalPages,
        total,
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error fetching project commits:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
